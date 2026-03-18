use finereport_tauri_shell_lib::commands::session::{
  CodexLaunchConfig,
  SessionRuntime,
  StartSessionRequest,
  start_session_in_project,
};
use finereport_tauri_shell_lib::domain::codex_process_manager::{
  CodexProcessManager,
  ProcessLaunchConfig,
};
use finereport_tauri_shell_lib::domain::event_bridge::{EventBridge, NullEventEmitter};
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
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

fn test_project_dir() -> PathBuf {
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .expect("system clock before unix epoch")
    .as_nanos();
  std::env::temp_dir().join(format!("session_bootstrap_{nanos}/projects/default"))
}

#[test]
fn session_start_persists_manifest() {
  let project_dir = test_project_dir();
  let request = StartSessionRequest {
    project_id: "default".into(),
    config_version: "v1".into(),
    first_message: "hello codex".into(),
    enabled_skills: vec!["finereport-template".into(), "browser-validate".into()],
    config: ProjectConfig {
      style: StyleProfile {
        theme: "light".into(),
      },
      workspace: WorkspaceProfile {
        name: "demo".into(),
        root_dir: "/tmp/demo".into(),
      },
      sync: SyncProfile {
        protocol: SyncProtocol::Sftp,
        local_source_dir: "/tmp/demo/reportlets".into(),
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
    },
    codex: CodexLaunchConfig {
      command: "sh".into(),
      args: vec!["-c".into(), "printf 'started\\n'".into()],
      working_dir: ".".into(),
    },
  };
  let process_manager = CodexProcessManager::default();
  let bridge = EventBridge::new(Arc::new(NullEventEmitter));

  let response = start_session_in_project(
    project_dir.as_path(),
    &request,
    SessionRuntime {
      manager: &process_manager,
      bridge: &bridge,
    },
    ProcessLaunchConfig {
      command: "sh".into(),
      args: vec!["-c".into(), "printf 'started\\n'".into()],
      working_dir: project_dir.clone(),
    },
  )
  .expect("start session");

  let session_dir = project_dir.join("sessions").join(&response.session_id);
  assert!(session_dir.join("transcript.jsonl").exists());
  assert!(session_dir.join("session-manifest.json").exists());
  assert!(session_dir.join("context").exists());
  assert!(session_dir.join("context/AGENTS.md").exists());
  assert!(session_dir.join("context/project-context.md").exists());
  assert!(session_dir.join("context/project-rules.md").exists());
  assert!(session_dir.join("context/mappings.json").exists());
  assert!(session_dir.join("logs").exists());
}
