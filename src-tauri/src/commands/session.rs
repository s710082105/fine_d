use super::session_runtime::configure_process_hooks;
use super::session_support::resolve_project_dir;
use crate::domain::codex_cli::build_exec_args;
use crate::domain::codex_process_manager::{
    CodexProcessManager, ProcessLaunchConfig, ProcessMetadata,
};
use crate::domain::event_bridge::EventBridge;
use crate::domain::project_config::ProjectConfig;
use crate::domain::session_store::{
    append_transcript_entry, bootstrap_session, SessionBootstrapInput,
};
use crate::domain::sync_dispatcher::SyncManager;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

pub struct SessionCommandState {
    pub process_manager: CodexProcessManager,
    pub sync_manager: SyncManager,
}

impl Default for SessionCommandState {
    fn default() -> Self {
        Self {
            process_manager: CodexProcessManager::default(),
            sync_manager: SyncManager::default(),
        }
    }
}

pub struct SessionRuntime<'a> {
    pub manager: &'a CodexProcessManager,
    pub bridge: &'a EventBridge,
    pub sync_manager: Option<&'a SyncManager>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CodexLaunchConfig {
    pub command: String,
    pub args: Vec<String>,
    pub working_dir: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StartSessionRequest {
    pub project_id: String,
    pub config_version: String,
    pub first_message: String,
    pub enabled_skills: Vec<String>,
    pub config: ProjectConfig,
    pub codex: CodexLaunchConfig,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionResponse {
    pub session_id: String,
    pub session_dir: String,
    pub process: ProcessMetadata,
}

#[tauri::command]
pub fn start_session(
    app: AppHandle,
    state: State<'_, SessionCommandState>,
    request: StartSessionRequest,
) -> Result<StartSessionResponse, String> {
    let project_dir = resolve_project_dir(&app, request.project_id.as_str())?;
    let bridge = EventBridge::from_app(app);
    let runtime = SessionRuntime {
        manager: &state.process_manager,
        bridge: &bridge,
        sync_manager: Some(&state.sync_manager),
    };
    let launch_config =
        validate_external_launch_config(&request.codex, request.first_message.as_str())?;
    start_session_in_project(project_dir.as_path(), &request, runtime, launch_config)
}

pub fn start_session_in_project(
    project_dir: &Path,
    request: &StartSessionRequest,
    runtime: SessionRuntime<'_>,
    launch_config: ProcessLaunchConfig,
) -> Result<StartSessionResponse, String> {
    let session_id = generate_session_id()?;
    runtime
        .bridge
        .emit_status(session_id.as_str(), "initializing session context")?;
    let bootstrap = bootstrap_session(
        project_dir,
        &SessionBootstrapInput {
            project_id: request.project_id.clone(),
            session_id: session_id.clone(),
            config_version: request.config_version.clone(),
            config: request.config.clone(),
            enabled_skills: request.enabled_skills.clone(),
        },
    )?;
    append_transcript_entry(
        bootstrap.transcript_path.as_path(),
        "user",
        request.first_message.as_str(),
        request.config_version.as_str(),
    )?;
    let launch_config = configure_process_hooks(
        launch_config,
        runtime.sync_manager,
        runtime.bridge,
        bootstrap.manifest_path.clone(),
    );
    if let Some(sync_manager) = runtime.sync_manager {
        runtime
            .bridge
            .emit_status(session_id.as_str(), "starting sync watcher")?;
        sync_manager.watch_session(session_id.as_str(), &request.config, runtime.bridge)?;
    }
    runtime
        .bridge
        .emit_status(session_id.as_str(), "starting codex process")?;
    let process =
        runtime
            .manager
            .start_process(session_id.as_str(), &launch_config, runtime.bridge);
    if process.is_err() {
        stop_sync_watcher(runtime.sync_manager, session_id.as_str());
    }
    let process = process?;
    runtime
        .bridge
        .emit_status(session_id.as_str(), "session started")?;
    Ok(StartSessionResponse {
        session_id,
        session_dir: bootstrap.session_dir.display().to_string(),
        process,
    })
}

fn stop_sync_watcher(sync_manager: Option<&SyncManager>, session_id: &str) {
    let Some(sync_manager) = sync_manager else {
        return;
    };
    sync_manager.stop_session(session_id);
}

fn validate_external_launch_config(
    config: &CodexLaunchConfig,
    first_message: &str,
) -> Result<ProcessLaunchConfig, String> {
    if config.command.trim() != "codex" {
        return Err("codex.command must be exactly 'codex'".into());
    }
    let working_dir = PathBuf::from(&config.working_dir);
    if !working_dir.is_absolute() {
        return Err("codex.working_dir must be an absolute path".into());
    }
    Ok(ProcessLaunchConfig {
        command: config.command.clone(),
        args: build_exec_args(&config.args, first_message),
        working_dir,
        exit_hook: None,
        stdout_hook: None,
    })
}

fn generate_session_id() -> Result<String, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to generate session id: {error}"))?
        .as_nanos();
    Ok(format!("session-{nanos}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_external_launch_config_rejects_non_codex_command() {
        let error = validate_external_launch_config(
            &CodexLaunchConfig {
                command: "sh".into(),
                args: vec!["-c".into(), "echo hi".into()],
                working_dir: "/tmp".into(),
            },
            "hello",
        )
        .expect_err("non-codex command must be rejected");
        assert!(error.contains("must be exactly 'codex'"));
    }

    #[test]
    fn validate_external_launch_config_rejects_relative_working_dir() {
        let error = validate_external_launch_config(
            &CodexLaunchConfig {
                command: "codex".into(),
                args: Vec::new(),
                working_dir: ".".into(),
            },
            "hello",
        )
        .expect_err("relative working dir must be rejected");
        assert!(error.contains("absolute path"));
    }

    #[test]
    fn validate_external_launch_config_builds_non_interactive_exec_command() {
        let launch_config = validate_external_launch_config(
            &CodexLaunchConfig {
                command: "codex".into(),
                args: vec!["--json".into()],
                working_dir: "/tmp".into(),
            },
            "生成报表",
        )
        .expect("codex launch config should be valid");

        assert_eq!(launch_config.command, "codex");
        assert_eq!(
            launch_config.args,
            vec![
                "exec",
                "--full-auto",
                "--skip-git-repo-check",
                "--color",
                "never",
                "--json",
                "生成报表",
            ]
        );
    }
}
