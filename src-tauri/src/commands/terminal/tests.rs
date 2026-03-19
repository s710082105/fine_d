use super::{
    close_terminal_session_with_manager, create_terminal_session_with_options,
    CloseTerminalSessionRequest, CreateTerminalSessionOptions, CreateTerminalSessionRequest,
};
use crate::domain::project_config::{ProjectConfig, WorkspaceProfile};
use crate::domain::terminal_event_bridge::{
    TerminalEvent, TerminalEventBridge, TerminalEventEmitter,
};
use crate::domain::terminal_manager::TerminalManager;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

const LONG_RUNNING_SCRIPT: &str = "trap 'exit 0' INT TERM; while true; do sleep 1; done";

struct NoopEmitter;

impl TerminalEventEmitter for NoopEmitter {
    fn emit(&self, _event: &TerminalEvent) -> Result<(), String> {
        Ok(())
    }
}

fn build_manager() -> TerminalManager {
    TerminalManager::new(TerminalEventBridge::new(Arc::new(NoopEmitter)))
}

fn unique_dir(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("terminal_commands_{name}_{nanos}"))
}

fn build_request(workspace_dir: &str) -> CreateTerminalSessionRequest {
    let mut config = ProjectConfig::default();
    config.workspace = WorkspaceProfile {
        name: "default".into(),
        root_dir: workspace_dir.into(),
    };
    CreateTerminalSessionRequest {
        project_id: "default".into(),
        config_version: "v1".into(),
        workspace_dir: workspace_dir.into(),
        shell: "bash".into(),
        env: None,
        config,
    }
}

#[test]
fn terminal_commands_create_terminal_session_rejects_missing_project_directory() {
    let missing_dir = unique_dir("missing");
    let manager = build_manager();
    let error = create_terminal_session_with_options(
        &manager,
        &build_request(missing_dir.to_string_lossy().as_ref()),
        &CreateTerminalSessionOptions::test_command("sh", vec!["-c".into(), "printf ok".into()]),
    )
    .expect_err("missing directory should be rejected");

    assert!(error.contains("does not exist"));
}

#[test]
fn terminal_commands_create_terminal_session_returns_metadata_on_success() {
    let project_dir = unique_dir("success");
    std::fs::create_dir_all(&project_dir).expect("create project directory");
    let manager = build_manager();
    let response = create_terminal_session_with_options(
        &manager,
        &build_request(project_dir.to_string_lossy().as_ref()),
        &CreateTerminalSessionOptions::test_command(
            "sh",
            vec!["-c".into(), LONG_RUNNING_SCRIPT.into()],
        ),
    )
    .expect("create terminal session");

    assert_eq!(response.session_id, response.process.session_id);
    assert_eq!(response.process.command, "sh");
    assert_eq!(
        response.process.working_dir,
        project_dir.display().to_string()
    );
    assert!(!response.process.started_at.is_empty());
    assert!(response.process.pid > 0);

    close_terminal_session_with_manager(
        &manager,
        &CloseTerminalSessionRequest {
            session_id: response.session_id,
        },
    )
    .expect("close created terminal session");
}

#[test]
fn terminal_commands_close_terminal_session_returns_error_for_unknown_session() {
    let manager = build_manager();
    let error = close_terminal_session_with_manager(
        &manager,
        &CloseTerminalSessionRequest {
            session_id: "terminal-unknown".into(),
        },
    )
    .expect_err("unknown session should fail");

    assert!(error.contains("terminal session not found"));
}
