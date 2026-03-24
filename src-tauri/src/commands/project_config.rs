use crate::domain::project_config::{ProjectConfig, PROJECT_SOURCE_SUBDIR};
use crate::domain::project_initializer::EmbeddedProjectInitializer;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::io::ErrorKind;
use std::io::Write;
use std::path::{Path, PathBuf};
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

fn normalize_sync_profile(config: &mut ProjectConfig) {
    config.sync.protocol = crate::domain::project_config::SyncProtocol::Fine;
    config.sync.remote_runtime_dir = PROJECT_SOURCE_SUBDIR.into();
}

fn normalize_legacy_project_config(value: Value) -> Value {
    normalize_legacy_sync_profile(normalize_legacy_style_profile(value))
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
