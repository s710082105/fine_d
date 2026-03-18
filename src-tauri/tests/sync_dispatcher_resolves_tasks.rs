use finereport_tauri_shell_lib::domain::project_config::{
  AiProfile,
  ProjectConfig,
  ProjectMapping,
  StyleProfile,
  SyncProfile,
  SyncProtocol,
  WorkspaceProfile,
};
use finereport_tauri_shell_lib::domain::sync_dispatcher::{
  SyncAction,
  resolve_sync_task,
};
use std::path::PathBuf;

fn build_config() -> ProjectConfig {
  ProjectConfig {
    style: StyleProfile {
      theme: "light".into(),
    },
    workspace: WorkspaceProfile {
      name: "default".into(),
      root_dir: "/tmp/project".into(),
    },
    sync: SyncProfile {
      protocol: SyncProtocol::Sftp,
      host: "files.example.com".into(),
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
      local: "reportlets".into(),
      remote: "reportlets".into(),
    }],
  }
}

#[test]
fn resolve_sync_task_maps_local_file_to_runtime_target() {
  let config = build_config();
  let task = resolve_sync_task(
    "session-1",
    &config,
    PathBuf::from("/tmp/project/reportlets/sales/report.cpt").as_path(),
    SyncAction::Update,
  )
  .expect("resolve sync task");

  assert_eq!(task.protocol, "sftp");
  assert_eq!(
    task.remote_path,
    "/srv/tomcat/webapps/webroot/WEB-INF/reportlets/sales/report.cpt"
  );
  assert_eq!(task.action, SyncAction::Update);
}

#[test]
fn resolve_sync_task_rejects_paths_outside_source_dir() {
  let config = build_config();
  let error = resolve_sync_task(
    "session-1",
    &config,
    PathBuf::from("/tmp/other/report.cpt").as_path(),
    SyncAction::Create,
  )
  .expect_err("path outside source dir must fail");

  assert!(error.contains("outside local_source_dir"));
}
