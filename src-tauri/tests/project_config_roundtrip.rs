use finereport_tauri_shell_lib::commands::project_config::{
  load_project_config_from_path,
  save_project_config_to_path,
};
use finereport_tauri_shell_lib::domain::project_config::{
  AiProfile,
  ProjectConfig,
  ProjectMapping,
  StyleProfile,
  SyncProfile,
  SyncProtocol,
  WorkspaceProfile,
};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn test_config_path() -> PathBuf {
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .expect("system clock before unix epoch")
    .as_nanos();
  std::env::temp_dir().join(format!("project_config_roundtrip_{nanos}.json"))
}

#[test]
fn project_config_roundtrip_preserves_sync_fields() {
  let config = ProjectConfig {
    style: StyleProfile {
      theme: "light".into(),
    },
    workspace: WorkspaceProfile {
      name: "default".into(),
      root_dir: "/tmp/project".into(),
    },
    sync: SyncProfile {
      protocol: SyncProtocol::Sftp,
      host: "127.0.0.1".into(),
      port: 22,
      username: "deploy".into(),
      local_source_dir: "/tmp/project/reportlets".into(),
      remote_runtime_dir: "/srv/tomcat/webapps/webroot/WEB-INF".into(),
      delete_propagation: true,
      auto_sync_on_change: true,
    },
    ai: AiProfile {
      provider: "openai".into(),
      model: "gpt-5".into(),
    },
    mappings: vec![ProjectMapping {
      local: "templates".into(),
      remote: "reportlets".into(),
    }],
  };

  let path = test_config_path();
  save_project_config_to_path(path.as_path(), &config).expect("save project config");
  let loaded = load_project_config_from_path(path.as_path()).expect("load project config");

  assert_eq!(loaded.sync.protocol, SyncProtocol::Sftp);
  assert_eq!(loaded.sync.host, "127.0.0.1");
  assert_eq!(loaded.sync.port, 22);
  assert_eq!(loaded.sync.username, "deploy");
  assert_eq!(loaded.sync.local_source_dir, "/tmp/project/reportlets");
  assert_eq!(
    loaded.sync.remote_runtime_dir,
    "/srv/tomcat/webapps/webroot/WEB-INF"
  );
  assert!(loaded.sync.delete_propagation);
  assert!(loaded.sync.auto_sync_on_change);
}

#[test]
fn load_project_config_from_missing_path_returns_default() {
  let path = test_config_path();
  let loaded = load_project_config_from_path(path.as_path()).expect("load default project config");

  assert_eq!(loaded, ProjectConfig::default());
}

#[test]
fn load_project_config_from_partial_payload_applies_defaults() {
  let path = test_config_path();
  std::fs::write(
    &path,
    r#"{
      "sync": {
        "host": "127.0.0.1",
        "port": 21,
        "username": "ftp-user",
        "local_source_dir": "/tmp/project/reportlets",
        "remote_runtime_dir": "/srv/tomcat/webapps/webroot/WEB-INF"
      }
    }"#,
  )
  .expect("write partial project config");

  let loaded = load_project_config_from_path(path.as_path()).expect("load partial project config");

  assert_eq!(loaded.style.theme, "light");
  assert_eq!(loaded.workspace.name, "default");
  assert_eq!(loaded.sync.protocol, SyncProtocol::Sftp);
  assert_eq!(loaded.sync.host, "127.0.0.1");
  assert_eq!(loaded.sync.port, 21);
  assert_eq!(loaded.sync.username, "ftp-user");
  assert!(loaded.sync.auto_sync_on_change);
}
