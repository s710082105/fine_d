use crate::commands::project_config::load_project_config_from_project_dir;
use crate::domain::project_config::{FineRemoteProfile, SyncProtocol};
use crate::domain::remote_directory_browser::RemoteDirectoryBrowser;
use crate::domain::remote_reportlet_browser::{RemoteReportletBrowser, RemoteReportletEntry};
use crate::domain::remote_runtime::{
    ProtocolRemoteRuntimeFactory, RemoteDirectoryEntry, RemoteRuntimeClientFactory,
};
use crate::domain::remote_sync_guard::{prepare_remote_create, prepare_remote_edit};
use crate::domain::sync_dispatcher::{resolve_sync_task, SyncAction};
use crate::domain::sync_transport::{ProtocolSyncTransport, SyncTransport};
use serde::Deserialize;
use serde::Serialize;
use std::env;
use std::ffi::OsString;
use std::path::Path;
use std::sync::Arc;
use tauri::AppHandle;

const PROJECT_SYNC_HOOK_FLAG: &str = "--project-sync-hook";
const PROJECT_SYNC_PREPARE_CREATE_FLAG: &str = "--project-sync-prepare-create";
const PROJECT_SYNC_PREPARE_EDIT_FLAG: &str = "--project-sync-prepare-edit";
const POST_COMMIT_SESSION_ID: &str = "git-post-commit";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRemoteDirectoriesRequest {
    pub designer_root: String,
    pub url: String,
    pub username: String,
    pub password: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestRemoteSyncConnectionResponse {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareSyncResponse {
    ok: bool,
    command: String,
    local_path: String,
    remote_path: String,
    message: String,
}

#[tauri::command]
pub fn list_remote_directories(
    _app: AppHandle,
    request: ListRemoteDirectoriesRequest,
) -> Result<Vec<RemoteDirectoryEntry>, String> {
    let profile = request.into_sync_profile();
    RemoteDirectoryBrowser::default().list_directories(&profile, &request.path)
}

#[tauri::command]
pub fn list_remote_reportlet_entries(
    _app: AppHandle,
    request: ListRemoteDirectoriesRequest,
) -> Result<Vec<RemoteReportletEntry>, String> {
    let path = normalize_browser_path(&request.path);
    let profile = request.into_sync_profile();
    RemoteReportletBrowser::default().list_reportlets(&profile, &path)
}

#[tauri::command]
pub fn pull_remote_reportlet_file(
    _app: AppHandle,
    project_dir: String,
    relative_path: String,
) -> Result<PrepareSyncResponse, String> {
    prepare_remote_edit_for_project(Path::new(&project_dir), &relative_path)
}

#[tauri::command]
pub fn push_local_reportlet_file(
    _app: AppHandle,
    project_dir: String,
    relative_path: String,
) -> Result<PrepareSyncResponse, String> {
    push_local_file_for_project(Path::new(&project_dir), &relative_path)
}

#[tauri::command]
pub fn test_remote_sync_connection(
    _app: AppHandle,
    request: ListRemoteDirectoriesRequest,
) -> Result<TestRemoteSyncConnectionResponse, String> {
    let path = normalize_browser_path(&request.path);
    let profile = request.into_sync_profile();
    match RemoteDirectoryBrowser::default().list_directories(&profile, &path) {
        Ok(_) => Ok(TestRemoteSyncConnectionResponse {
            ok: true,
            message: "远程设计连接成功".into(),
        }),
        Err(error) => Ok(TestRemoteSyncConnectionResponse {
            ok: false,
            message: error,
        }),
    }
}

pub fn try_run_cli() -> Result<bool, String> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    match args.first().and_then(|value| value.to_str()) {
        Some(PROJECT_SYNC_HOOK_FLAG) => run_post_commit_sync(&args)?,
        Some(PROJECT_SYNC_PREPARE_CREATE_FLAG) => run_prepare_create(&args)?,
        Some(PROJECT_SYNC_PREPARE_EDIT_FLAG) => run_prepare_edit(&args)?,
        _ => return Ok(false),
    }
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
    let profile = response.config.fine_remote_profile()?;
    ProtocolSyncTransport::default().apply(&task, &profile)
}

fn run_prepare_create(args: &[OsString]) -> Result<(), String> {
    let (local_path, remote_path, profile) =
        resolve_cli_sync_target(args, PROJECT_SYNC_PREPARE_CREATE_FLAG)?;
    let factory: Arc<dyn RemoteRuntimeClientFactory> = ProtocolRemoteRuntimeFactory::shared();
    let mut client = factory.connect(&profile)?;
    prepare_remote_create(client.as_mut(), local_path.as_path(), &remote_path)?;
    println!(
        "{}",
        prepare_sync_success_stdout(
            "prepare-create",
            local_path.display().to_string().as_str(),
            remote_path.as_str(),
        )
    );
    Ok(())
}

fn run_prepare_edit(args: &[OsString]) -> Result<(), String> {
    if args.len() != 3 {
        return Err(format!("{PROJECT_SYNC_PREPARE_EDIT_FLAG} expects project dir and relative path"));
    }
    let project_dir = Path::new(args[1].to_str().ok_or("project dir is not valid utf-8")?);
    let relative_path = args[2].to_str().ok_or("relative path is not valid utf-8")?;
    let response = prepare_remote_edit_for_project(project_dir, relative_path)?;
    println!(
        "{}",
        serde_json::to_string(&response).map_err(|error| error.to_string())?
    );
    Ok(())
}

fn prepare_remote_edit_for_project(
    project_dir: &Path,
    relative_path: &str,
) -> Result<PrepareSyncResponse, String> {
    let local_path = project_dir.join(relative_path);
    let response = load_project_config_from_project_dir(project_dir)?;
    if !response.exists {
        return Err("project-config.json is required for sync preparation".into());
    }
    let task = resolve_sync_task(
        POST_COMMIT_SESSION_ID,
        &response.config,
        local_path.as_path(),
        SyncAction::Update,
    )?;
    let profile = response.config.fine_remote_profile()?;
    let factory: Arc<dyn RemoteRuntimeClientFactory> = ProtocolRemoteRuntimeFactory::shared();
    let mut client = factory.connect(&profile)?;
    prepare_remote_edit(client.as_mut(), local_path.as_path(), &task.remote_path)?;
    Ok(PrepareSyncResponse {
        ok: true,
        command: "prepare-edit".into(),
        local_path: local_path.display().to_string(),
        remote_path: task.remote_path,
        message: prepare_sync_success_message("prepare-edit").into(),
    })
}

fn push_local_file_for_project(
    project_dir: &Path,
    relative_path: &str,
) -> Result<PrepareSyncResponse, String> {
    let local_path = project_dir.join(relative_path);
    let response = load_project_config_from_project_dir(project_dir)?;
    if !response.exists {
        return Err("project-config.json is required for local file sync".into());
    }
    let task = resolve_sync_task(
        POST_COMMIT_SESSION_ID,
        &response.config,
        local_path.as_path(),
        SyncAction::Update,
    )?;
    let profile = response.config.fine_remote_profile()?;
    ProtocolSyncTransport::default().apply(&task, &profile)?;
    Ok(PrepareSyncResponse {
        ok: true,
        command: "push-local".into(),
        local_path: local_path.display().to_string(),
        remote_path: task.remote_path,
        message: prepare_sync_success_message("push-local").into(),
    })
}

fn resolve_cli_sync_target(
    args: &[OsString],
    flag: &str,
) -> Result<(std::path::PathBuf, String, FineRemoteProfile), String> {
    if args.len() != 3 {
        return Err(format!("{flag} expects project dir and relative path"));
    }
    let project_dir = Path::new(args[1].to_str().ok_or("project dir is not valid utf-8")?);
    let relative_path = args[2].to_str().ok_or("relative path is not valid utf-8")?;
    let response = load_project_config_from_project_dir(project_dir)?;
    if !response.exists {
        return Err("project-config.json is required for sync preparation".into());
    }
    let local_path = project_dir.join(relative_path);
    let task = resolve_sync_task(
        POST_COMMIT_SESSION_ID,
        &response.config,
        &local_path,
        SyncAction::Create,
    )?;
    let profile = response.config.fine_remote_profile()?;
    Ok((local_path, task.remote_path, profile))
}

fn parse_sync_action(action: &str) -> Result<SyncAction, String> {
    match action {
        "delete" => Ok(SyncAction::Delete),
        "create" => Ok(SyncAction::Create),
        "update" => Ok(SyncAction::Update),
        "upsert" => Ok(SyncAction::Update),
        _ => Err(format!("unsupported project sync action: {action}")),
    }
}

impl ListRemoteDirectoriesRequest {
    fn into_sync_profile(&self) -> FineRemoteProfile {
        FineRemoteProfile {
            protocol: SyncProtocol::Fine,
            designer_root: self.designer_root.trim().into(),
            url: self.url.trim().into(),
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

fn prepare_sync_success_stdout(command: &str, local_path: &str, remote_path: &str) -> String {
    serde_json::json!(PrepareSyncResponse {
        ok: true,
        command: command.into(),
        local_path: local_path.into(),
        remote_path: remote_path.into(),
        message: prepare_sync_success_message(command).into(),
    })
    .to_string()
}

fn prepare_sync_success_message(command: &str) -> &'static str {
    match command {
        "prepare-create" => "远端检查通过，已创建远端占位文件并同步到本地，可继续创建模板。",
        "prepare-edit" => "远端检查通过，已拉取远端最新内容到本地，可继续修改模板。",
        "push-local" => "本地文件已上传到远端。",
        _ => "远端检查通过。",
    }
}

#[cfg(test)]
mod tests {
    use super::prepare_sync_success_stdout;

    #[test]
    fn prepare_sync_success_stdout_is_machine_readable() {
        let stdout = prepare_sync_success_stdout(
            "prepare-edit",
            "/tmp/project/reportlets/demo.cpt",
            "reportlets/demo.cpt",
        );
        let value: serde_json::Value =
            serde_json::from_str(&stdout).expect("parse prepare sync stdout");

        assert_eq!(value["ok"], true);
        assert_eq!(value["command"], "prepare-edit");
        assert_eq!(value["localPath"], "/tmp/project/reportlets/demo.cpt");
        assert_eq!(value["remotePath"], "reportlets/demo.cpt");
        assert!(value["message"]
            .as_str()
            .expect("prepare sync message")
            .contains("远端检查通过"));
    }
}
