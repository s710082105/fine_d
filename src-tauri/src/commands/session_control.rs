use super::session::SessionCommandState;
use super::session_support::resolve_project_dir;
use crate::domain::event_bridge::EventBridge;
use crate::domain::project_config::ProjectConfig;
use crate::domain::session_store::{SessionBootstrapInput, refresh_session_context};
use serde::Deserialize;
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
  state.process_manager.interrupt_process(request.session_id.as_str())?;
  bridge.emit_status(request.session_id.as_str(), "interrupt requested")
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
