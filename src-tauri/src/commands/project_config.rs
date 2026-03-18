use crate::domain::project_config::ProjectConfig;
use std::fs;
use std::io::ErrorKind;
use std::io::Write;
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
  config.validate()?;

  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|error| format!("failed to create project config directory: {error}"))?;
  }

  let payload = serde_json::to_string_pretty(config)
    .map_err(|error| format!("failed to serialize project config: {error}"))?;
  write_atomically(path, &payload)
}

pub fn load_project_config_from_path(path: &Path) -> Result<ProjectConfig, String> {
  let payload = match fs::read_to_string(path) {
    Ok(payload) => payload,
    Err(error) if error.kind() == ErrorKind::NotFound => return Ok(ProjectConfig::default()),
    Err(error) => return Err(format!("failed to read project config: {error}")),
  };
  let config: ProjectConfig =
    serde_json::from_str(&payload).map_err(|error| format!("failed to parse project config: {error}"))?;
  config.validate()?;
  Ok(config)
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

fn write_atomically(path: &Path, payload: &str) -> Result<(), String> {
  let temp_path = path.with_extension("json.tmp");
  let mut file = fs::File::create(&temp_path)
    .map_err(|error| format!("failed to create temporary project config file: {error}"))?;
  file
    .write_all(payload.as_bytes())
    .map_err(|error| format!("failed to write temporary project config file: {error}"))?;
  file
    .sync_all()
    .map_err(|error| format!("failed to sync temporary project config file: {error}"))?;
  fs::rename(&temp_path, path)
    .map_err(|error| format!("failed to replace project config file atomically: {error}"))
}
