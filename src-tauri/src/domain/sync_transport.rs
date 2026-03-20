use super::project_config::{SyncProfile, SyncProtocol};
use super::remote_runtime::{ProtocolRemoteRuntimeFactory, RemoteRuntimeClientFactory};
use super::sync_dispatcher::{ResolvedSyncTask, SyncAction};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub trait SyncTransport: Send + Sync {
    fn apply(&self, task: &ResolvedSyncTask, profile: &SyncProfile) -> Result<(), String>;
}

#[derive(Clone)]
pub struct ProtocolSyncTransport {
    factory: Arc<dyn RemoteRuntimeClientFactory>,
}

impl Default for ProtocolSyncTransport {
    fn default() -> Self {
        Self::with_factory(ProtocolRemoteRuntimeFactory::shared())
    }
}

impl ProtocolSyncTransport {
    pub fn shared() -> Arc<dyn SyncTransport> {
        Arc::new(Self::default())
    }

    pub fn with_factory(factory: Arc<dyn RemoteRuntimeClientFactory>) -> Self {
        Self { factory }
    }
}

impl SyncTransport for ProtocolSyncTransport {
    fn apply(&self, task: &ResolvedSyncTask, profile: &SyncProfile) -> Result<(), String> {
        match profile.protocol {
            SyncProtocol::Local => apply_local(task),
            SyncProtocol::Sftp | SyncProtocol::Ftp => apply_remote(task, profile, &self.factory),
        }
    }
}

fn apply_local(task: &ResolvedSyncTask) -> Result<(), String> {
    let remote_path = PathBuf::from(&task.remote_path);
    match task.action {
        SyncAction::Delete => {
            if !remote_path.exists() {
                return Ok(());
            }
            fs::remove_file(&remote_path)
                .map_err(|error| format!("failed to delete local runtime file: {error}"))
        }
        SyncAction::Create | SyncAction::Update => {
            ensure_local_directory(&remote_path)?;
            fs::copy(&task.local_path, &remote_path)
                .map(|_| ())
                .map_err(|error| format!("failed to copy local runtime file: {error}"))
        }
    }
}

fn apply_remote(
    task: &ResolvedSyncTask,
    profile: &SyncProfile,
    factory: &Arc<dyn RemoteRuntimeClientFactory>,
) -> Result<(), String> {
    let mut client = factory.connect(profile)?;
    match task.action {
        SyncAction::Delete => client.delete_file(&task.remote_path),
        SyncAction::Create | SyncAction::Update => {
            client.upload_file(Path::new(&task.local_path), &task.remote_path)
        }
    }
}

fn ensure_local_directory(remote_path: &Path) -> Result<(), String> {
    let Some(parent) = remote_path.parent() else {
        return Ok(());
    };
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create local runtime directory: {error}"))
}
