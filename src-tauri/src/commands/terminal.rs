use super::environment::check_codex_installation;
use crate::domain::codex_auth::{append_runtime_config_args, build_codex_environment};
use crate::domain::project_config::ProjectConfig;
use crate::domain::terminal_event_bridge::TerminalEventBridge;
use crate::domain::terminal_manager::{
    TerminalLaunchConfig, TerminalManager, TerminalSessionMetadata,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

const CODEX_COMMAND: &str = "codex";
const TERM_ENV: &str = "TERM";
const TERM_VALUE: &str = "xterm-256color";
const COLORTERM_ENV: &str = "COLORTERM";
const COLORTERM_VALUE: &str = "truecolor";
const FORCE_COLOR_ENV: &str = "FORCE_COLOR";
const FORCE_COLOR_VALUE: &str = "1";

#[cfg(test)]
mod tests;

#[derive(Default)]
pub struct TerminalCommandState {
    manager: Mutex<Option<TerminalManager>>,
}

impl TerminalCommandState {
    fn manager_for_app(&self, app: &AppHandle) -> Result<TerminalManager, String> {
        let mut guard = self
            .manager
            .lock()
            .map_err(|error| format!("failed to acquire terminal command state lock: {error}"))?;
        if let Some(manager) = guard.as_ref() {
            return Ok(manager.clone());
        }
        let manager = TerminalManager::new(TerminalEventBridge::from_app(app.clone()));
        *guard = Some(manager.clone());
        Ok(manager)
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateTerminalSessionRequest {
    pub project_id: String,
    pub config_version: String,
    pub workspace_dir: String,
    pub shell: String,
    pub env: Option<HashMap<String, String>>,
    pub config: ProjectConfig,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTerminalSessionResponse {
    pub session_id: String,
    pub process: TerminalSessionMetadata,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WriteTerminalInputRequest {
    pub session_id: String,
    pub payload: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResizeTerminalRequest {
    pub session_id: String,
    pub columns: u32,
    pub rows: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CloseTerminalSessionRequest {
    pub session_id: String,
}

#[derive(Debug, Clone)]
struct CreateTerminalSessionOptions {
    command: String,
    args: Vec<String>,
    require_codex_installation: bool,
}

impl CreateTerminalSessionOptions {
    fn codex_default(config: &ProjectConfig) -> Self {
        Self {
            command: CODEX_COMMAND.into(),
            args: build_codex_cli_args(config),
            require_codex_installation: true,
        }
    }

    #[cfg(test)]
    fn test_command(command: &str, args: Vec<String>) -> Self {
        Self {
            command: command.into(),
            args,
            require_codex_installation: false,
        }
    }
}

#[tauri::command]
pub fn create_terminal_session(
    app: AppHandle,
    state: State<'_, TerminalCommandState>,
    request: CreateTerminalSessionRequest,
) -> Result<CreateTerminalSessionResponse, String> {
    let manager = state.manager_for_app(&app)?;
    create_terminal_session_with_options(
        &manager,
        &request,
        &CreateTerminalSessionOptions::codex_default(&request.config),
    )
}

fn create_terminal_session_with_options(
    manager: &TerminalManager,
    request: &CreateTerminalSessionRequest,
    options: &CreateTerminalSessionOptions,
) -> Result<CreateTerminalSessionResponse, String> {
    let working_dir = validate_workspace_dir(request.workspace_dir.as_str())?;
    if options.require_codex_installation {
        ensure_codex_installed()?;
    }
    let session_id = generate_terminal_session_id()?;
    let process = manager.start_session(
        session_id.as_str(),
        &build_terminal_launch_config(request, options, working_dir)?,
    )?;
    Ok(CreateTerminalSessionResponse {
        session_id,
        process,
        created_at: unix_timestamp()?,
    })
}

#[tauri::command]
pub fn write_terminal_input(
    app: AppHandle,
    state: State<'_, TerminalCommandState>,
    request: WriteTerminalInputRequest,
) -> Result<(), String> {
    let manager = state.manager_for_app(&app)?;
    write_terminal_input_with_manager(&manager, &request)
}

fn write_terminal_input_with_manager(
    manager: &TerminalManager,
    request: &WriteTerminalInputRequest,
) -> Result<(), String> {
    manager.write_input(request.session_id.as_str(), request.payload.as_str())
}

#[tauri::command]
pub fn resize_terminal(
    app: AppHandle,
    state: State<'_, TerminalCommandState>,
    request: ResizeTerminalRequest,
) -> Result<(), String> {
    let manager = state.manager_for_app(&app)?;
    resize_terminal_with_manager(&manager, &request)
}

fn resize_terminal_with_manager(
    manager: &TerminalManager,
    request: &ResizeTerminalRequest,
) -> Result<(), String> {
    let rows = to_u16(request.rows, "rows")?;
    let columns = to_u16(request.columns, "columns")?;
    manager.resize_session(request.session_id.as_str(), rows, columns)
}

#[tauri::command]
pub fn close_terminal_session(
    app: AppHandle,
    state: State<'_, TerminalCommandState>,
    request: CloseTerminalSessionRequest,
) -> Result<(), String> {
    let manager = state.manager_for_app(&app)?;
    close_terminal_session_with_manager(&manager, &request)
}

fn close_terminal_session_with_manager(
    manager: &TerminalManager,
    request: &CloseTerminalSessionRequest,
) -> Result<(), String> {
    manager.close_session(request.session_id.as_str())
}

fn validate_workspace_dir(workspace_dir: &str) -> Result<PathBuf, String> {
    let trimmed = workspace_dir.trim();
    if trimmed.is_empty() {
        return Err("workspace_dir is required".into());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err("workspace_dir must be an absolute path".into());
    }
    if !path.exists() {
        return Err(format!("workspace_dir does not exist: {}", path.display()));
    }
    if !path.is_dir() {
        return Err(format!(
            "workspace_dir must be an existing directory: {}",
            path.display()
        ));
    }
    Ok(path)
}

fn ensure_codex_installed() -> Result<(), String> {
    let status = check_codex_installation()?;
    if status.installed {
        return Ok(());
    }
    Err("codex is not installed".into())
}

fn build_terminal_launch_config(
    request: &CreateTerminalSessionRequest,
    options: &CreateTerminalSessionOptions,
    working_dir: PathBuf,
) -> Result<TerminalLaunchConfig, String> {
    Ok(TerminalLaunchConfig {
        command: options.command.clone(),
        args: options.args.clone(),
        env: build_terminal_environment(&request.config, request.env.as_ref())?,
        working_dir,
    })
}

pub(super) fn build_codex_cli_args(config: &ProjectConfig) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    append_runtime_config_args(&mut args, config);
    args
}

pub(super) fn build_terminal_environment(
    config: &ProjectConfig,
    request_env: Option<&HashMap<String, String>>,
) -> Result<HashMap<String, String>, String> {
    let mut env = request_env.cloned().unwrap_or_default();
    env.insert(TERM_ENV.into(), TERM_VALUE.into());
    env.insert(COLORTERM_ENV.into(), COLORTERM_VALUE.into());
    env.insert(FORCE_COLOR_ENV.into(), FORCE_COLOR_VALUE.into());
    build_codex_environment(Some(&env), config)
}

fn generate_terminal_session_id() -> Result<String, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to generate terminal session id: {error}"))?
        .as_nanos();
    Ok(format!("terminal-{nanos}"))
}

fn unix_timestamp() -> Result<String, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to get unix timestamp: {error}"))?;
    Ok(now.as_secs().to_string())
}

fn to_u16(value: u32, field_name: &str) -> Result<u16, String> {
    u16::try_from(value).map_err(|_| format!("{field_name} must be <= {}", u16::MAX))
}
