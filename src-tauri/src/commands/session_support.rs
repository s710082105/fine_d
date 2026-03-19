use std::path::Component;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn resolve_project_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
    resolve_project_dir_from_root(app_data_dir.join("projects"), project_id)
}

pub fn resolve_project_dir_from_root(root: PathBuf, project_id: &str) -> Result<PathBuf, String> {
    validate_project_id(project_id)?;
    Ok(root.join(project_id))
}

pub fn validate_project_id(project_id: &str) -> Result<(), String> {
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
}
