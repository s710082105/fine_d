use crate::domain::project_config::ProjectConfig;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const PROJECT_CONFIG_DIR: &str = "projects/default";
const PROJECT_CONFIG_FILE: &str = "project-config.json";

fn resolve_project_config_path(app: &AppHandle) -> Result<PathBuf, String> {
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
  Ok(app_data_dir.join(PROJECT_CONFIG_DIR).join(PROJECT_CONFIG_FILE))
}

pub fn save_project_config_to_path(path: &Path, config: &ProjectConfig) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|error| format!("failed to create project config directory: {error}"))?;
  }

  let payload = serde_json::to_string_pretty(config)
    .map_err(|error| format!("failed to serialize project config: {error}"))?;
  fs::write(path, payload).map_err(|error| format!("failed to write project config: {error}"))
}

pub fn load_project_config_from_path(path: &Path) -> Result<ProjectConfig, String> {
  let payload = match fs::read_to_string(path) {
    Ok(payload) => payload,
    Err(error) if error.kind() == ErrorKind::NotFound => return Ok(ProjectConfig::default()),
    Err(error) => return Err(format!("failed to read project config: {error}")),
  };
  serde_json::from_str(&payload).map_err(|error| format!("failed to parse project config: {error}"))
}

#[tauri::command]
pub fn save_project_config(app: AppHandle, config: ProjectConfig) -> Result<(), String> {
  let path = resolve_project_config_path(&app)?;
  save_project_config_to_path(path.as_path(), &config)
}

#[tauri::command]
pub fn load_project_config(app: AppHandle) -> Result<ProjectConfig, String> {
  let path = resolve_project_config_path(&app)?;
  load_project_config_from_path(path.as_path())
}
