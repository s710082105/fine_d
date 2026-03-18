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
  WorkspaceProfile,
};
use std::path::PathBuf;

fn test_config_path() -> PathBuf {
  std::env::temp_dir().join("project_config_roundtrip.json")
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
      protocol: "SFTP".into(),
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

  assert_eq!(loaded.sync.protocol, "SFTP");
  assert_eq!(loaded.sync.local_source_dir, "/tmp/project/reportlets");
  assert_eq!(
    loaded.sync.remote_runtime_dir,
    "/srv/tomcat/webapps/webroot/WEB-INF"
  );
  assert!(loaded.sync.delete_propagation);
  assert!(loaded.sync.auto_sync_on_change);
}
