use crate::domain::project_config::{DataConnectionProfile, DbType, ProjectConfig, PROJECT_SOURCE_SUBDIR};
use crate::domain::project_initializer::EmbeddedProjectInitializer;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::io::ErrorKind;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;

const PROJECT_CONFIG_FILE: &str = "project-config.json";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadProjectConfigResponse {
    pub exists: bool,
    pub config: ProjectConfig,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReportletEntry {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub children: Vec<ReportletEntry>,
}

fn resolve_project_config_path(project_dir: &Path) -> Result<PathBuf, String> {
    if !project_dir.is_absolute() {
        return Err("project_dir must be an absolute path".into());
    }
    Ok(project_dir.join(PROJECT_CONFIG_FILE))
}

fn project_name(project_dir: &Path) -> String {
    project_dir
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "default".into())
}

pub fn save_project_config_to_path(path: &Path, config: &ProjectConfig) -> Result<(), String> {
    let mut normalized = config.clone();
    normalize_sync_profile(&mut normalized);
    normalized.validate()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create project config directory: {error}"))?;
    }

    let payload = serde_json::to_string_pretty(&normalized)
        .map_err(|error| format!("failed to serialize project config: {error}"))?;
    write_atomically(path, &payload)
}

pub fn load_project_config_from_path(path: &Path) -> Result<ProjectConfig, String> {
    let payload = match fs::read_to_string(path) {
        Ok(payload) => payload,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(ProjectConfig::default()),
        Err(error) => return Err(format!("failed to read project config: {error}")),
    };
    let value: Value = serde_json::from_str(&payload)
        .map_err(|error| format!("failed to parse project config: {error}"))?;
    let normalized = normalize_legacy_project_config(value);
    let mut config: ProjectConfig = serde_json::from_value(normalized)
        .map_err(|error| format!("failed to parse project config: {error}"))?;
    normalize_sync_profile(&mut config);
    config.validate()?;
    Ok(config)
}

#[tauri::command]
pub fn save_project_config(
    _app: AppHandle,
    project_dir: String,
    mut config: ProjectConfig,
) -> Result<(), String> {
    let project_path = Path::new(&project_dir);
    let path = resolve_project_config_path(project_path)?;
    config.workspace.root_dir = project_dir.clone();
    if config.workspace.name.trim().is_empty() {
        config.workspace.name = project_name(project_path);
    }
    save_project_config_to_path(path.as_path(), &config)?;
    EmbeddedProjectInitializer::default().refresh_project_context(project_path, &config)
}

pub fn load_project_config_from_project_dir(
    project_dir: &Path,
) -> Result<LoadProjectConfigResponse, String> {
    let path = resolve_project_config_path(project_dir)?;
    let project_dir_string = project_dir.display().to_string();
    if !path.exists() {
        let mut config = ProjectConfig::default();
        config.workspace.root_dir = project_dir_string;
        config.workspace.name = project_name(project_dir);
        return Ok(LoadProjectConfigResponse {
            exists: false,
            config,
        });
    }
    let mut config = load_project_config_from_path(path.as_path())?;
    config.workspace.root_dir = project_dir_string;
    if config.workspace.name.trim().is_empty() {
        config.workspace.name = project_name(project_dir);
    }
    Ok(LoadProjectConfigResponse {
        exists: true,
        config,
    })
}

pub fn list_reportlet_entries_from_project_dir(
    project_dir: &Path,
    relative_path: Option<&str>,
) -> Result<Vec<ReportletEntry>, String> {
    let source_dir = project_dir.join(PROJECT_SOURCE_SUBDIR);
    if !source_dir.exists() {
        return Ok(Vec::new());
    }
    let target_dir = resolve_reportlet_directory(source_dir.as_path(), relative_path)?;
    if !target_dir.is_dir() {
        return Err(format!(
            "reportlets path is not a directory: {}",
            target_dir.display()
        ));
    }
    read_reportlet_entries(target_dir.as_path(), source_dir.as_path())
}

#[tauri::command]
pub fn load_project_config(
    _app: AppHandle,
    project_dir: String,
) -> Result<LoadProjectConfigResponse, String> {
    load_project_config_from_project_dir(Path::new(&project_dir))
}

#[tauri::command]
pub fn list_reportlet_entries(
    _app: AppHandle,
    project_dir: String,
    relative_path: Option<String>,
) -> Result<Vec<ReportletEntry>, String> {
    list_reportlet_entries_from_project_dir(Path::new(&project_dir), relative_path.as_deref())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestConnectionResult {
    pub ok: bool,
    pub message: String,
}

#[tauri::command]
pub async fn test_data_connection(
    connection: DataConnectionProfile,
) -> Result<TestConnectionResult, String> {
    let db_type_str = match connection.db_type {
        DbType::Mysql => "mysql",
        DbType::Postgresql => "postgresql",
        DbType::Oracle => "oracle",
        DbType::Sqlserver => "sqlserver",
    };

    // URL 编码密码中的特殊字符
    let encoded_password = urlencoding::encode(&connection.password);

    let script = format!(
        r#"
import sys, json
try:
    from sqlalchemy import create_engine, text
except ImportError:
    print(json.dumps({{"ok": False, "message": "缺少 sqlalchemy，请运行: pip install sqlalchemy"}}))
    sys.exit(0)

db_type = "{db_type}"
scheme = None
if db_type == "mysql":
    try:
        import pymysql
        scheme = "mysql+pymysql"
    except ImportError:
        print(json.dumps({{"ok": False, "message": "缺少 pymysql 驱动，请运行: pip install pymysql"}}))
        sys.exit(0)
elif db_type == "postgresql":
    try:
        import psycopg2
        scheme = "postgresql+psycopg2"
    except ImportError:
        try:
            import psycopg
            scheme = "postgresql+psycopg"
        except ImportError:
            print(json.dumps({{"ok": False, "message": "缺少 PostgreSQL 驱动，请运行: pip install psycopg[binary]"}}))
            sys.exit(0)
elif db_type == "oracle":
    try:
        import oracledb
        scheme = "oracle+oracledb"
    except ImportError:
        print(json.dumps({{"ok": False, "message": "缺少 oracledb 驱动，请运行: pip install oracledb"}}))
        sys.exit(0)
elif db_type == "sqlserver":
    try:
        import pymssql
        scheme = "mssql+pymssql"
    except ImportError:
        print(json.dumps({{"ok": False, "message": "缺少 pymssql 驱动，请运行: pip install pymssql"}}))
        sys.exit(0)

url = f"{{scheme}}://{user}:{password}@{host}:{port}/{database}"
try:
    kwargs = {{}}
    if db_type in ("mysql", "postgresql"):
        kwargs["connect_args"] = {{"connect_timeout": 5}}
    engine = create_engine(url, **kwargs)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print(json.dumps({{"ok": True, "message": "连接成功"}}))
except Exception as e:
    print(json.dumps({{"ok": False, "message": str(e)}}))
"#,
        db_type = db_type_str,
        user = connection.username.replace('"', r#"\""#),
        password = encoded_password,
        host = connection.host.replace('"', r#"\""#),
        port = connection.port,
        database = connection.database.replace('"', r#"\""#),
    );

    let python = find_python().map_err(|e| format!("找不到 Python: {e}"))?;

    let output = Command::new(&python)
        .args(["-c", &script])
        .output()
        .map_err(|e| format!("执行 Python 脚本失败: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stdout.is_empty() {
        return Ok(TestConnectionResult {
            ok: false,
            message: if stderr.is_empty() {
                "Python 脚本无输出".into()
            } else {
                stderr
            },
        });
    }

    serde_json::from_str::<TestConnectionResult>(&stdout).map_err(|e| {
        format!(
            "解析测试结果失败: {e}\nstdout: {stdout}\nstderr: {stderr}"
        )
    })
}

fn find_python() -> Result<String, String> {
    // Windows 上优先 py (Python Launcher) 和 python，python3 可能触发 Store 别名
    let candidates = if cfg!(target_os = "windows") {
        &["py", "python", "python3"][..]
    } else {
        &["python3", "python", "py"][..]
    };
    for name in candidates {
        if let Ok(output) = Command::new(name).arg("--version").output() {
            if output.status.success() {
                return Ok(name.to_string());
            }
        }
    }
    Err("python3/python/py 均不可用".into())
}

fn write_atomically(path: &Path, payload: &str) -> Result<(), String> {
    let temp_path = path.with_extension("json.tmp");
    let mut file = fs::File::create(&temp_path)
        .map_err(|error| format!("failed to create temporary project config file: {error}"))?;
    file.write_all(payload.as_bytes())
        .map_err(|error| format!("failed to write temporary project config file: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("failed to sync temporary project config file: {error}"))?;
    fs::rename(&temp_path, path)
        .map_err(|error| format!("failed to replace project config file atomically: {error}"))
}

fn read_reportlet_entries(root: &Path, base: &Path) -> Result<Vec<ReportletEntry>, String> {
    let mut entries: Vec<_> = fs::read_dir(root)
        .map_err(|error| format!("failed to read reportlets directory: {error}"))?
        .map(|entry| entry.map_err(|error| format!("failed to read reportlets entry: {error}")))
        .collect::<Result<Vec<_>, _>>()?;
    entries.retain(|entry| !is_hidden_entry(entry));
    entries.sort_by_key(|entry| entry.file_name());
    entries
        .into_iter()
        .map(|entry| build_reportlet_entry(entry.path().as_path(), base))
        .collect()
}

fn resolve_reportlet_directory(
    source_dir: &Path,
    relative_path: Option<&str>,
) -> Result<PathBuf, String> {
    let Some(relative_path) = relative_path.map(str::trim).filter(|path| !path.is_empty()) else {
        return Ok(source_dir.to_path_buf());
    };
    let relative = Path::new(relative_path);
    if relative.is_absolute() {
        return Err("relative_path must stay inside reportlets".into());
    }
    if relative.components().any(|component| {
        matches!(
            component,
            std::path::Component::ParentDir
                | std::path::Component::RootDir
                | std::path::Component::Prefix(_)
        )
    }) {
        return Err("relative_path must stay inside reportlets".into());
    }
    Ok(source_dir.join(relative))
}

fn normalize_legacy_data_connections(mut value: Value) -> Value {
    let Some(object) = value.as_object_mut() else {
        return value;
    };
    if object.contains_key("data_connections") {
        return value;
    }
    let Some(legacy) = object.remove("data_connection") else {
        return value;
    };
    if legacy.is_null() {
        object.insert("data_connections".into(), Value::Array(Vec::new()));
        return value;
    }
    object.insert("data_connections".into(), Value::Array(vec![legacy]));
    value
}

fn normalize_sync_profile(config: &mut ProjectConfig) {
    config.sync.protocol = crate::domain::project_config::SyncProtocol::Fine;
    config.sync.remote_runtime_dir = PROJECT_SOURCE_SUBDIR.into();
}

fn normalize_legacy_dsn_fields(mut value: Value) -> Value {
    let Some(object) = value.as_object_mut() else {
        return value;
    };
    let Some(connections) = object.get_mut("data_connections") else {
        return value;
    };
    let Some(array) = connections.as_array_mut() else {
        return value;
    };
    for conn in array.iter_mut() {
        let Some(conn_obj) = conn.as_object_mut() else {
            continue;
        };
        // 如果已有 host 字段，跳过迁移
        if conn_obj.contains_key("host") {
            continue;
        }
        // 从 dsn 字段解析连接信息（格式：scheme://host:port/database）
        if let Some(dsn) = conn_obj.remove("dsn").and_then(|v| v.as_str().map(String::from)) {
            if let Some(rest) = dsn.strip_prefix("mysql://") {
                conn_obj.entry("db_type").or_insert(json!("mysql"));
                parse_dsn_parts(conn_obj, rest);
            } else if let Some(rest) = dsn.strip_prefix("postgresql://") {
                conn_obj.entry("db_type").or_insert(json!("postgresql"));
                parse_dsn_parts(conn_obj, rest);
            } else {
                conn_obj.entry("db_type").or_insert(json!("mysql"));
                conn_obj.entry("host").or_insert(json!(""));
                conn_obj.entry("port").or_insert(json!(3306));
                conn_obj.entry("database").or_insert(json!(""));
            }
        }
    }
    value
}

fn parse_dsn_parts(conn_obj: &mut serde_json::Map<String, Value>, host_port_db: &str) {
    // 格式：host:port/database
    let (host_port, database) = host_port_db
        .split_once('/')
        .unwrap_or((host_port_db, ""));
    let (host, port_str) = host_port.split_once(':').unwrap_or((host_port, ""));
    let port: u16 = port_str.parse().unwrap_or(3306);
    conn_obj.entry("host").or_insert(json!(host));
    conn_obj.entry("port").or_insert(json!(port));
    conn_obj.entry("database").or_insert(json!(database));
}

fn normalize_legacy_project_config(value: Value) -> Value {
    normalize_legacy_sync_profile(normalize_legacy_style_profile(
        normalize_legacy_dsn_fields(normalize_legacy_data_connections(value)),
    ))
}

fn normalize_legacy_sync_profile(mut value: Value) -> Value {
    let Some(object) = value.as_object_mut() else {
        return value;
    };
    let Some(sync) = object.get_mut("sync").and_then(Value::as_object_mut) else {
        return value;
    };
    sync.insert("protocol".into(), json!("fine"));
    let legacy_username = sync
        .remove("username")
        .and_then(|item| item.as_str().map(str::to_owned));
    let legacy_password = sync
        .remove("password")
        .and_then(|item| item.as_str().map(str::to_owned));
    sync.remove("host");
    sync.remove("port");
    let preview = object
        .entry("preview")
        .or_insert_with(|| json!({}))
        .as_object_mut();
    let Some(preview) = preview else {
        return value;
    };
    if preview
        .get("account")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .is_empty()
    {
        if let Some(username) = legacy_username {
            preview.insert("account".into(), json!(username));
        }
    }
    if preview
        .get("password")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .is_empty()
    {
        if let Some(password) = legacy_password {
            preview.insert("password".into(), json!(password));
        }
    }
    value
}

fn normalize_legacy_style_profile(mut value: Value) -> Value {
    let Some(object) = value.as_object_mut() else {
        return value;
    };
    let Some(style) = object.get("style").cloned() else {
        return value;
    };
    if style.get("instructions").and_then(Value::as_str).is_some() {
        return value;
    }
    object.insert(
        "style".into(),
        json!({ "instructions": legacy_style_instructions(&style) }),
    );
    value
}

fn legacy_style_instructions(style: &Value) -> String {
    let Some(object) = style.as_object() else {
        return String::new();
    };
    [
        ("font_family", "字体"),
        ("font_size", "字号"),
        ("line_height", "行高"),
        ("column_width", "列宽"),
        ("header_font_family", "表头字体"),
        ("header_font_size", "表头字号"),
        ("number_format", "数字格式"),
    ]
    .into_iter()
    .filter_map(|(key, label)| legacy_style_line(object, key, label))
    .collect::<Vec<_>>()
    .join("\n")
}

fn legacy_style_line(
    object: &serde_json::Map<String, Value>,
    key: &str,
    label: &str,
) -> Option<String> {
    let value = object.get(key)?;
    let text = match value {
        Value::String(content) => content.trim().to_string(),
        Value::Number(content) => content.to_string(),
        _ => String::new(),
    };
    if text.is_empty() {
        return None;
    }
    Some(format!("{label}：{text}"))
}

fn is_hidden_entry(entry: &fs::DirEntry) -> bool {
    entry.file_name().to_string_lossy().starts_with('.')
}

fn build_reportlet_entry(path: &Path, base: &Path) -> Result<ReportletEntry, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("failed to stat reportlet entry: {error}"))?;
    let relative_path = path
        .strip_prefix(base)
        .map_err(|error| format!("failed to resolve reportlet relative path: {error}"))?;
    Ok(ReportletEntry {
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_default(),
        path: relative_path.to_string_lossy().replace('\\', "/"),
        kind: if metadata.is_dir() {
            "directory"
        } else {
            "file"
        }
        .into(),
        children: Vec::new(),
    })
}
