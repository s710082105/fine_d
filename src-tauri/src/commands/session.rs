use crate::domain::codex_process_manager::{
  CodexProcessManager,
  ProcessLaunchConfig,
  ProcessMetadata,
};
use crate::domain::event_bridge::EventBridge;
use crate::domain::project_config::ProjectConfig;
use crate::domain::session_store::{SessionBootstrapInput, bootstrap_session};
use crate::domain::sync_dispatcher::SyncManager;
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Component;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TranscriptLine {
  role: String,
  content: String,
  timestamp: String,
  config_version: String,
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
  let launch_config = validate_external_launch_config(&request.codex)?;
  start_session_in_project(
    project_dir.as_path(),
    &request,
    runtime,
    launch_config,
  )
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
  append_transcript(
    bootstrap.transcript_path.as_path(),
    request.first_message.as_str(),
    request.config_version.as_str(),
  )?;
  let launch_config = configure_process_hooks(launch_config, runtime.sync_manager);
  if let Some(sync_manager) = runtime.sync_manager {
    runtime
      .bridge
      .emit_status(session_id.as_str(), "starting sync watcher")?;
    sync_manager.watch_session(session_id.as_str(), &request.config, runtime.bridge)?;
  }
  runtime
    .bridge
    .emit_status(session_id.as_str(), "starting codex process")?;
  let process = runtime.manager.start_process(
    session_id.as_str(),
    &launch_config,
    runtime.bridge,
  );
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

fn configure_process_hooks(
  mut launch_config: ProcessLaunchConfig,
  sync_manager: Option<&SyncManager>,
) -> ProcessLaunchConfig {
  let Some(sync_manager) = sync_manager.cloned() else {
    return launch_config;
  };
  launch_config.exit_hook = Some(Arc::new(move |session_id| {
    sync_manager.stop_session(session_id);
  }));
  launch_config
}

fn stop_sync_watcher(sync_manager: Option<&SyncManager>, session_id: &str) {
  let Some(sync_manager) = sync_manager else {
    return;
  };
  sync_manager.stop_session(session_id);
}

fn resolve_project_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
  resolve_project_dir_from_root(app_data_dir.join("projects"), project_id)
}

fn resolve_project_dir_from_root(root: PathBuf, project_id: &str) -> Result<PathBuf, String> {
  validate_project_id(project_id)?;
  Ok(root.join(project_id))
}

fn validate_project_id(project_id: &str) -> Result<(), String> {
  if project_id.trim().is_empty() {
    return Err("project_id is required".into());
  }
  let path = Path::new(project_id);
  if path.is_absolute() {
    return Err("project_id must not be absolute".into());
  }
  if path
    .components()
    .any(|component| !matches!(component, Component::Normal(_)))
  {
    return Err("project_id contains invalid path components".into());
  }
  Ok(())
}

fn validate_external_launch_config(config: &CodexLaunchConfig) -> Result<ProcessLaunchConfig, String> {
  if config.command.trim() != "codex" {
    return Err("codex.command must be exactly 'codex'".into());
  }
  let working_dir = PathBuf::from(&config.working_dir);
  if !working_dir.is_absolute() {
    return Err("codex.working_dir must be an absolute path".into());
  }
  Ok(ProcessLaunchConfig {
    command: config.command.clone(),
    args: config.args.clone(),
    working_dir,
    exit_hook: None,
  })
}

fn append_transcript(path: &Path, content: &str, config_version: &str) -> Result<(), String> {
  let mut file = OpenOptions::new()
    .append(true)
    .open(path)
    .map_err(|error| format!("failed to open transcript: {error}"))?;
  let line = TranscriptLine {
    role: "user".into(),
    content: content.into(),
    timestamp: unix_timestamp()?,
    config_version: config_version.into(),
  };
  let payload =
    serde_json::to_string(&line).map_err(|error| format!("failed to serialize transcript: {error}"))?;
  writeln!(file, "{payload}").map_err(|error| format!("failed to write transcript: {error}"))
}

fn generate_session_id() -> Result<String, String> {
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|error| format!("failed to generate session id: {error}"))?
    .as_nanos();
  Ok(format!("session-{nanos}"))
}

fn unix_timestamp() -> Result<String, String> {
  let now = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|error| format!("failed to get unix timestamp: {error}"))?;
  Ok(now.as_secs().to_string())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn resolve_project_dir_rejects_path_traversal() {
    let root = PathBuf::from("/tmp/finereport-projects");
    let error = resolve_project_dir_from_root(root, "../escape")
      .expect_err("path traversal project id must be rejected");
    assert!(error.contains("invalid path components"));
  }

  #[test]
  fn validate_external_launch_config_rejects_non_codex_command() {
    let error = validate_external_launch_config(&CodexLaunchConfig {
      command: "sh".into(),
      args: vec!["-c".into(), "echo hi".into()],
      working_dir: "/tmp".into(),
    })
    .expect_err("non-codex command must be rejected");
    assert!(error.contains("must be exactly 'codex'"));
  }

  #[test]
  fn validate_external_launch_config_rejects_relative_working_dir() {
    let error = validate_external_launch_config(&CodexLaunchConfig {
      command: "codex".into(),
      args: Vec::new(),
      working_dir: ".".into(),
    })
    .expect_err("relative working dir must be rejected");
    assert!(error.contains("absolute path"));
  }
}
