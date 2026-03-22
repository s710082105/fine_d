use super::project_config::FineRemoteProfile;
use super::remote_sync_guard::{sync_remote_delete, sync_remote_upsert};
use super::remote_runtime::{ProtocolRemoteRuntimeFactory, RemoteRuntimeClientFactory};
use super::sync_dispatcher::{ResolvedSyncTask, SyncAction};
use std::path::Path;
use std::sync::Arc;

pub trait SyncTransport: Send + Sync {
    fn apply(&self, task: &ResolvedSyncTask, profile: &FineRemoteProfile) -> Result<(), String>;
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
    fn apply(&self, task: &ResolvedSyncTask, profile: &FineRemoteProfile) -> Result<(), String> {
        apply_remote(task, profile, &self.factory)
    }
}

fn apply_remote(
    task: &ResolvedSyncTask,
    profile: &FineRemoteProfile,
    factory: &Arc<dyn RemoteRuntimeClientFactory>,
) -> Result<(), String> {
    let mut client = factory.connect(profile)?;
    match task.action {
        SyncAction::Delete => sync_remote_delete(client.as_mut(), &task.remote_path),
        SyncAction::Create | SyncAction::Update => sync_remote_upsert(
            client.as_mut(),
            Path::new(&task.local_path),
            &task.remote_path,
        ),
    }
}
