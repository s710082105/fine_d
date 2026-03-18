use crate::domain::project_config::ProjectConfig;
use std::fs;
use std::path::{Path, PathBuf};

const PROJECT_CONFIG_DIR: &str = ".finereport";
const PROJECT_CONFIG_FILE: &str = "project-config.json";

fn resolve_project_config_path() -> Result<PathBuf, String> {
  let cwd = std::env::current_dir().map_err(|error| {
    format!("failed to resolve current directory for project config: {error}")
  })?;
  Ok(cwd.join(PROJECT_CONFIG_DIR).join(PROJECT_CONFIG_FILE))
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
  let payload =
    fs::read_to_string(path).map_err(|error| format!("failed to read project config: {error}"))?;
  serde_json::from_str(&payload).map_err(|error| format!("failed to parse project config: {error}"))
}

#[tauri::command]
pub fn save_project_config(config: ProjectConfig) -> Result<(), String> {
  let path = resolve_project_config_path()?;
  save_project_config_to_path(path.as_path(), &config)
}

#[tauri::command]
pub fn load_project_config() -> Result<ProjectConfig, String> {
  let path = resolve_project_config_path()?;
  load_project_config_from_path(path.as_path())
}
