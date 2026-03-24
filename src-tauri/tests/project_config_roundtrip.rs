use finereport_tauri_shell_lib::commands::project_config::{
    load_project_config_from_path, load_project_config_from_project_dir,
    save_project_config_to_path,
};
use finereport_tauri_shell_lib::domain::project_config::{
    ProjectConfig, ProjectMapping, SyncProtocol, WorkspaceProfile,
};
use serde_json::json;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TEST_PATH_COUNTER: AtomicU64 = AtomicU64::new(0);

fn test_config_path() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    let suffix = TEST_PATH_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!("project_config_roundtrip_{nanos}_{suffix}.json"))
}

fn test_project_root() -> PathBuf {
    std::env::temp_dir().join("project-config-roundtrip")
}

#[test]
fn project_config_roundtrip_preserves_sync_fields() {
    let mut config = ProjectConfig::default();
    config.workspace = WorkspaceProfile {
        name: "default".into(),
        root_dir: test_project_root().display().to_string(),
    };
    config.sync.designer_root = "/Applications/FineReport".into();
    config.sync.remote_runtime_dir = "/srv/tomcat/webapps/webroot/WEB-INF".into();
    config.sync.delete_propagation = true;
    config.sync.auto_sync_on_change = true;
    config.preview.account = "preview-user".into();
    config.preview.password = "preview-pass".into();
    config.ai.api_key = "sk-demo".into();
    config.mappings = vec![ProjectMapping {
        local: "templates".into(),
        remote: "reportlets".into(),
    }];

    let path = test_config_path();
    save_project_config_to_path(path.as_path(), &config).expect("save project config");
    let loaded = load_project_config_from_path(path.as_path()).expect("load project config");

    assert_eq!(loaded.sync.protocol, SyncProtocol::Fine);
    assert_eq!(loaded.sync.designer_root, "/Applications/FineReport");
    assert_eq!(
        loaded.local_source_dir(),
        test_project_root().join("reportlets")
    );
    assert_eq!(
        loaded.sync.remote_runtime_dir,
        "reportlets"
    );
    assert!(loaded.sync.delete_propagation);
    assert!(loaded.sync.auto_sync_on_change);
    assert_eq!(loaded.preview.account, "preview-user");
    assert_eq!(loaded.preview.password, "preview-pass");
    assert_eq!(loaded.ai.api_key, "sk-demo");
}

#[test]
fn load_project_config_from_missing_path_returns_default() {
    let path = test_config_path();
    let loaded =
        load_project_config_from_path(path.as_path()).expect("load default project config");

    assert_eq!(loaded, ProjectConfig::default());
}

#[test]
fn load_project_config_from_partial_payload_applies_defaults() {
    let path = test_config_path();
    let local_source_dir = test_project_root().join("reportlets");
    std::fs::write(
        &path,
        json!({
          "sync": {
            "protocol": "sftp",
            "local_source_dir": local_source_dir.display().to_string(),
            "remote_runtime_dir": "/srv/tomcat/webapps/webroot/WEB-INF"
          }
        })
        .to_string(),
    )
    .expect("write partial project config");

    let loaded =
        load_project_config_from_path(path.as_path()).expect("load partial project config");
    let value = serde_json::to_value(&loaded).expect("serialize loaded config");

    assert_eq!(loaded.workspace.name, "default");
    assert_eq!(loaded.sync.protocol, SyncProtocol::Fine);
    assert!(loaded.sync.auto_sync_on_change);
    assert_eq!(value["style"]["instructions"], "");
    assert_eq!(value["preview"]["mode"], "embedded");
    assert_eq!(value["sync"]["designer_root"], "");
    assert_eq!(value["sync"]["remote_runtime_dir"], "reportlets");
}

#[test]
fn load_project_config_supports_local_sync_preview_and_style_fields() {
    let path = test_config_path();
    let local_source_dir = test_project_root().join("reportlets");
    let runtime_dir = std::env::temp_dir().join("project-config-runtime/reportlets");
    std::fs::write(
        &path,
        json!({
          "style": {
            "instructions": "表头使用深色粗体，数据列右对齐，金额保留两位小数。"
          },
          "data_connections": [
            {
              "connection_name": "FR Demo",
              "dsn": "mysql://127.0.0.1:3306/demo",
              "username": "report",
              "password": "secret"
            }
          ],
          "preview": {
            "url": "http://127.0.0.1:8075/webroot/decision",
            "mode": "external",
            "account": "preview-user",
            "password": "preview-pass"
          },
          "ai": {
            "provider": "openai",
            "model": "gpt-5",
            "api_key": "sk-demo"
          },
          "sync": {
            "protocol": "local",
            "local_source_dir": local_source_dir.display().to_string(),
            "remote_runtime_dir": runtime_dir.display().to_string(),
            "delete_propagation": true,
            "auto_sync_on_change": true
          }
        })
        .to_string(),
    )
    .expect("write local sync project config");

    let loaded = load_project_config_from_path(path.as_path()).expect("load local sync config");
    let value = serde_json::to_value(&loaded).expect("serialize loaded local config");

    assert_eq!(value["sync"]["protocol"], "fine");
    assert_eq!(
        value["preview"]["url"],
        "http://127.0.0.1:8075/webroot/decision"
    );
    assert_eq!(value["preview"]["mode"], "external");
    assert_eq!(value["preview"]["account"], "preview-user");
    assert_eq!(value["preview"]["password"], "preview-pass");
    assert_eq!(value["ai"]["api_key"], "sk-demo");
    assert_eq!(
        value["style"]["instructions"],
        "表头使用深色粗体，数据列右对齐，金额保留两位小数。"
    );
    assert!(value.get("data_connections").is_none());
}

#[test]
fn load_project_config_converts_legacy_style_fields_into_text_instructions() {
    let path = test_config_path();
    let runtime_dir = std::env::temp_dir().join("project-config-runtime/reportlets");
    std::fs::write(
        &path,
        json!({
          "style": {
            "font_family": "Microsoft YaHei",
            "font_size": 14,
            "line_height": 1.8,
            "column_width": 24,
            "header_font_family": "DIN Alternate",
            "header_font_size": 16,
            "number_format": "#,##0.00"
          },
          "sync": {
            "protocol": "local",
            "remote_runtime_dir": runtime_dir.display().to_string()
          }
        })
        .to_string(),
    )
    .expect("write legacy style config");

    let loaded = load_project_config_from_path(path.as_path()).expect("load migrated config");

    assert!(loaded.style.instructions.contains("字体：Microsoft YaHei"));
    assert!(loaded.style.instructions.contains("字号：14"));
    assert!(loaded
        .style
        .instructions
        .contains("表头字体：DIN Alternate"));
    assert!(loaded.style.instructions.contains("数字格式：#,##0.00"));
}

#[test]
fn load_project_config_ignores_legacy_single_data_connection_field() {
    let path = test_config_path();
    std::fs::write(
        &path,
        json!({
          "data_connection": {
            "connection_name": "Legacy",
            "dsn": "mysql://127.0.0.1:3306/legacy",
            "username": "legacy-user",
            "password": "legacy-pass"
          },
          "sync": {
            "host": "127.0.0.1",
            "port": 21,
            "username": "ftp-user",
            "password": "ftp-pass",
            "remote_runtime_dir": "/srv/tomcat/webapps/webroot/WEB-INF"
          }
        })
        .to_string(),
    )
    .expect("write legacy project config");

    let loaded = load_project_config_from_path(path.as_path()).expect("load legacy project config");
    let value = serde_json::to_value(&loaded).expect("serialize legacy config");

    assert!(value.get("data_connections").is_none());
    assert_eq!(loaded.sync.protocol, SyncProtocol::Fine);
}

#[test]
fn remote_sync_profile_requires_password() {
    let mut loaded = ProjectConfig::default();
    loaded.sync.designer_root = std::env::temp_dir().display().to_string();
    loaded.preview.account = "preview-user".into();
    let error = loaded
        .fine_remote_profile()
        .expect_err("remote sync profile without password must fail");

    assert!(error.contains("preview.password is required"));
}

#[test]
fn remote_sync_profile_requires_designer_root() {
    let loaded = ProjectConfig::default();
    let error = loaded
        .fine_remote_profile()
        .expect_err("remote sync profile without designer_root must fail");

    assert!(error.contains("sync.designer_root is required"));
}

#[test]
fn load_project_config_ignores_legacy_ai_base_url() {
    let path = test_config_path();
    std::fs::write(
        &path,
        json!({
          "ai": {
            "provider": "openai",
            "model": "gpt-5",
            "base_url": "http://example.invalid",
            "api_key": "sk-demo"
          },
          "sync": {
            "host": "127.0.0.1",
            "port": 21,
            "username": "ftp-user",
            "password": "ftp-pass",
            "remote_runtime_dir": "/srv/runtime"
          }
        })
        .to_string(),
    )
    .expect("write legacy ai base_url config");

    let loaded = load_project_config_from_path(path.as_path()).expect("load legacy ai config");

    assert_eq!(loaded.ai.provider, "openai");
    assert_eq!(loaded.ai.model, "gpt-5");
    assert_eq!(loaded.ai.api_key, "sk-demo");

    save_project_config_to_path(path.as_path(), &loaded).expect("rewrite loaded legacy ai config");
    let rewritten = std::fs::read_to_string(path.as_path()).expect("read rewritten config");
    assert!(!rewritten.contains("base_url"));
}

#[test]
fn load_project_config_from_project_dir_reports_missing_file() {
    let project_dir = std::env::temp_dir().join("finereport_missing_project_config");
    let response = load_project_config_from_project_dir(project_dir.as_path())
        .expect("load project config response");

    assert!(!response.exists);
    assert_eq!(
        response.config.workspace.root_dir,
        project_dir.display().to_string()
    );
}
