use crate::commands::project_config::load_project_config_from_project_dir;
use crate::domain::project_config::{SyncProfile, SyncProtocol};
use crate::domain::remote_directory_browser::RemoteDirectoryBrowser;
use crate::domain::remote_runtime::RemoteDirectoryEntry;
use crate::domain::sync_dispatcher::{resolve_sync_task, SyncAction};
use crate::domain::sync_transport::{ProtocolSyncTransport, SyncTransport};
use serde::Deserialize;
use std::env;
use std::ffi::OsString;
use std::path::Path;
use tauri::AppHandle;

const PROJECT_SYNC_HOOK_FLAG: &str = "--project-sync-hook";
const POST_COMMIT_SESSION_ID: &str = "git-post-commit";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRemoteDirectoriesRequest {
    pub protocol: SyncProtocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub path: String,
}

#[tauri::command]
pub fn list_remote_directories(
    _app: AppHandle,
    request: ListRemoteDirectoriesRequest,
) -> Result<Vec<RemoteDirectoryEntry>, String> {
    let profile = request.into_sync_profile();
    profile.validate()?;
    RemoteDirectoryBrowser::default().list_directories(&profile, &request.path)
}

pub fn try_run_cli() -> Result<bool, String> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    if args.first() != Some(&OsString::from(PROJECT_SYNC_HOOK_FLAG)) {
        return Ok(false);
    }
    run_post_commit_sync(&args)?;
    Ok(true)
}

fn run_post_commit_sync(args: &[OsString]) -> Result<(), String> {
    if args.len() != 4 {
        return Err("project sync hook expects project dir, action and relative path".into());
    }
    let project_dir = Path::new(args[1].to_str().ok_or("project dir is not valid utf-8")?);
    let action = parse_sync_action(args[2].to_str().ok_or("action is not valid utf-8")?)?;
    let relative_path = args[3].to_str().ok_or("relative path is not valid utf-8")?;
    let response = load_project_config_from_project_dir(project_dir)?;
    if !response.exists {
        return Err("project-config.json is required for post-commit sync".into());
    }
    let local_path = project_dir.join(relative_path);
    let task = resolve_sync_task(
        POST_COMMIT_SESSION_ID,
        &response.config,
        &local_path,
        action,
    )?;
    ProtocolSyncTransport::default().apply(&task, &response.config.sync)
}

fn parse_sync_action(action: &str) -> Result<SyncAction, String> {
    match action {
        "delete" => Ok(SyncAction::Delete),
        "upsert" => Ok(SyncAction::Update),
        _ => Err(format!("unsupported project sync action: {action}")),
    }
}

impl ListRemoteDirectoriesRequest {
    fn into_sync_profile(&self) -> SyncProfile {
        SyncProfile {
            protocol: self.protocol.clone(),
            host: self.host.clone(),
            port: self.port,
            username: self.username.clone(),
            password: self.password.clone(),
            remote_runtime_dir: normalize_browser_path(&self.path),
            delete_propagation: false,
            auto_sync_on_change: false,
        }
    }
}

fn normalize_browser_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        "/".into()
    } else {
        trimmed.into()
    }
}
