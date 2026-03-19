use finereport_tauri_shell_lib::commands::session_control::{
    refresh_session_context_in_project, RefreshSessionContextRequest,
};
use finereport_tauri_shell_lib::domain::event_bridge::{EventBridge, NullEventEmitter};
use finereport_tauri_shell_lib::domain::project_config::{
    ProjectConfig, ProjectMapping, SyncProtocol, WorkspaceProfile,
};
use finereport_tauri_shell_lib::domain::session_store::{bootstrap_session, SessionBootstrapInput};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

fn test_project_dir() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("session_refresh_{nanos}/projects/default"))
}

fn build_config(project_dir: &PathBuf, host: &str, protocol: SyncProtocol) -> ProjectConfig {
    let mut config = ProjectConfig::default();
    config.workspace = WorkspaceProfile {
        name: "demo".into(),
        root_dir: project_dir.display().to_string(),
    };
    config.sync.protocol = protocol;
    config.sync.host = host.into();
    config.sync.port = 22;
    config.sync.username = "deploy".into();
    config.sync.remote_runtime_dir = "/srv/runtime".into();
    config.sync.delete_propagation = true;
    config.sync.auto_sync_on_change = true;
    config.mappings = vec![ProjectMapping {
        local: "reportlets".into(),
        remote: "reportlets".into(),
    }];
    config
}

#[test]
fn refresh_session_context_rebuilds_runtime_files_and_manifest() {
    let project_dir = test_project_dir();
    fs::create_dir_all(project_dir.join("reportlets")).expect("create source root");
    let initial_config = build_config(&project_dir, "old.example.com", SyncProtocol::Sftp);

    let bootstrap = bootstrap_session(
        project_dir.as_path(),
        &SessionBootstrapInput {
            project_id: "default".into(),
            session_id: "session-1".into(),
            config_version: "v1".into(),
            config: initial_config,
            enabled_skills: vec!["fr-create".into()],
        },
    )
    .expect("bootstrap session");

    let refreshed_config = build_config(&project_dir, "new.example.com", SyncProtocol::Ftp);
    refresh_session_context_in_project(
        project_dir.as_path(),
        &RefreshSessionContextRequest {
            project_id: "default".into(),
            session_id: "session-1".into(),
            config_version: "v3".into(),
            enabled_skills: vec!["chrome-cdp".into(), "fr-db".into()],
            config: refreshed_config,
        },
        &EventBridge::new(Arc::new(NullEventEmitter)),
    )
    .expect("refresh session context");

    let project_context = fs::read_to_string(bootstrap.context_dir.join("project-context.md"))
        .expect("read project context");
    let project_rules = fs::read_to_string(bootstrap.context_dir.join("project-rules.md"))
        .expect("read project rules");
    let manifest = fs::read_to_string(bootstrap.manifest_path).expect("read refreshed manifest");

    assert!(project_context.contains("new.example.com"));
    assert!(project_context.contains("protocol: ftp"));
    assert!(project_rules.contains("protocol: ftp"));
    assert!(manifest.contains("\"configVersion\": \"v3\""));
    assert!(manifest.contains("\"enabledSkills\": [\n    \"chrome-cdp\",\n    \"fr-db\"\n  ]"));
}
