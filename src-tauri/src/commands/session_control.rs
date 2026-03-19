use super::session::{CodexLaunchConfig, SessionCommandState};
use super::session_runtime::configure_process_hooks;
use super::session_support::resolve_project_dir;
use crate::domain::codex_cli::build_resume_args;
use crate::domain::codex_process_manager::{ProcessLaunchConfig, ProcessMetadata};
use crate::domain::event_bridge::EventBridge;
use crate::domain::project_git::uses_git_post_commit_sync;
use crate::domain::project_config::ProjectConfig;
use crate::domain::session_store::{
    append_transcript_entry, refresh_session_context, session_manifest_path,
    session_transcript_path, SessionBootstrapInput,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};

#[derive(Debug, Clone, Deserialize)]
pub struct RefreshSessionContextRequest {
    pub project_id: String,
    pub session_id: String,
    pub config_version: String,
    pub enabled_skills: Vec<String>,
    pub config: ProjectConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InterruptSessionRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SendSessionMessageRequest {
    pub project_id: String,
    pub session_id: String,
    pub config_version: String,
    pub message: String,
    pub codex_session_id: String,
    pub config: ProjectConfig,
    pub codex: CodexLaunchConfig,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendSessionMessageResponse {
    pub session_id: String,
    pub process: ProcessMetadata,
}

#[tauri::command]
pub fn refresh_session_context_command(
    app: AppHandle,
    request: RefreshSessionContextRequest,
) -> Result<(), String> {
    let project_dir = resolve_project_dir(&app, request.project_id.as_str())?;
    let bridge = EventBridge::from_app(app);
    refresh_session_context_in_project(project_dir.as_path(), &request, &bridge)
}

#[tauri::command]
pub fn interrupt_session_command(
    app: AppHandle,
    state: State<'_, SessionCommandState>,
    request: InterruptSessionRequest,
) -> Result<(), String> {
    let bridge = EventBridge::from_app(app);
    state
        .process_manager
        .interrupt_process(request.session_id.as_str())?;
    bridge.emit_status(request.session_id.as_str(), "interrupt requested")
}

#[tauri::command]
pub fn send_session_message_command(
    app: AppHandle,
    state: State<'_, SessionCommandState>,
    request: SendSessionMessageRequest,
) -> Result<SendSessionMessageResponse, String> {
    let project_dir = resolve_project_dir(&app, request.project_id.as_str())?;
    let bridge = EventBridge::from_app(app);
    let launch_config = validate_resume_launch_config(
        &request.codex,
        request.codex_session_id.as_str(),
        request.message.as_str(),
    )?;
    send_session_message_in_project(
        project_dir.as_path(),
        &request,
        &state.process_manager,
        Some(&state.sync_manager),
        &bridge,
        launch_config,
    )
}

pub fn refresh_session_context_in_project(
    project_dir: &std::path::Path,
    request: &RefreshSessionContextRequest,
    bridge: &EventBridge,
) -> Result<(), String> {
    refresh_session_context(
        project_dir,
        &SessionBootstrapInput {
            project_id: request.project_id.clone(),
            session_id: request.session_id.clone(),
            config_version: request.config_version.clone(),
            config: request.config.clone(),
            enabled_skills: request.enabled_skills.clone(),
        },
    )?;
    bridge.emit_status(
        request.session_id.as_str(),
        &format!("session context refreshed to {}", request.config_version),
    )
}

pub fn send_session_message_in_project(
    project_dir: &Path,
    request: &SendSessionMessageRequest,
    process_manager: &crate::domain::codex_process_manager::CodexProcessManager,
    sync_manager: Option<&crate::domain::sync_dispatcher::SyncManager>,
    bridge: &EventBridge,
    launch_config: ProcessLaunchConfig,
) -> Result<SendSessionMessageResponse, String> {
    let transcript_path = session_transcript_path(project_dir, request.session_id.as_str());
    let manifest_path = session_manifest_path(project_dir, request.session_id.as_str());
    append_transcript_entry(
        transcript_path.as_path(),
        "user",
        request.message.as_str(),
        request.config_version.as_str(),
    )?;
    let launch_config = configure_process_hooks(launch_config, sync_manager, bridge, manifest_path);
    if let Some(sync_manager) = sync_manager {
        if uses_git_post_commit_sync(project_dir)? {
            bridge.emit_status(request.session_id.as_str(), "git post-commit sync enabled")?;
        } else {
            bridge.emit_status(request.session_id.as_str(), "starting sync watcher")?;
            sync_manager.watch_session(request.session_id.as_str(), &request.config, bridge)?;
        }
    }
    bridge.emit_status(request.session_id.as_str(), "resuming codex process")?;
    let process =
        process_manager.start_process(request.session_id.as_str(), &launch_config, bridge);
    if process.is_err() {
        stop_sync_watcher(sync_manager, request.session_id.as_str());
    }
    let process = process?;
    bridge.emit_status(request.session_id.as_str(), "session resumed")?;
    Ok(SendSessionMessageResponse {
        session_id: request.session_id.clone(),
        process,
    })
}

fn validate_resume_launch_config(
    config: &CodexLaunchConfig,
    codex_session_id: &str,
    message: &str,
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
        args: build_resume_args(codex_session_id, &config.args, message),
        working_dir,
        exit_hook: None,
        stdout_hook: None,
    })
}

fn stop_sync_watcher(
    sync_manager: Option<&crate::domain::sync_dispatcher::SyncManager>,
    session_id: &str,
) {
    let Some(sync_manager) = sync_manager else {
        return;
    };
    sync_manager.stop_session(session_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_resume_launch_config_builds_resume_command() {
        let launch_config = validate_resume_launch_config(
            &CodexLaunchConfig {
                command: "codex".into(),
                args: vec!["--json".into()],
                working_dir: "/tmp".into(),
            },
            "codex-session-1",
            "继续执行",
        )
        .expect("resume launch config should be valid");

        assert_eq!(
            launch_config.args,
            vec![
                "exec",
                "resume",
                "--full-auto",
                "--skip-git-repo-check",
                "--json",
                "codex-session-1",
                "继续执行",
            ]
        );
    }
}
