use super::project_config::FineRemoteProfile;
use super::remote_runtime::{ProtocolRemoteRuntimeFactory, RemoteRuntimeClientFactory};
use std::fs;
use std::path::Path;
use std::sync::Arc;

pub trait RuntimeSyncBootstrapper: Send + Sync {
    fn replace_project_tree(
        &self,
        source_root: &Path,
        profile: &FineRemoteProfile,
    ) -> Result<(), String>;
}

#[derive(Clone)]
pub struct ProtocolRuntimeSyncBootstrapper {
    factory: Arc<dyn RemoteRuntimeClientFactory>,
}

impl Default for ProtocolRuntimeSyncBootstrapper {
    fn default() -> Self {
        Self::with_factory(ProtocolRemoteRuntimeFactory::shared())
    }
}

impl ProtocolRuntimeSyncBootstrapper {
    pub fn with_factory(factory: Arc<dyn RemoteRuntimeClientFactory>) -> Self {
        Self { factory }
    }
}

impl RuntimeSyncBootstrapper for ProtocolRuntimeSyncBootstrapper {
    fn replace_project_tree(
        &self,
        source_root: &Path,
        profile: &FineRemoteProfile,
    ) -> Result<(), String> {
        reset_project_source_root(source_root)?;
        let mut client = self.factory.connect(profile)?;
        client.download_tree(&profile.remote_runtime_dir, source_root)
    }
}

fn reset_project_source_root(source_root: &Path) -> Result<(), String> {
    if source_root.exists() {
        fs::remove_dir_all(source_root)
            .map_err(|error| format!("failed to reset project source directory: {error}"))?;
    }
    fs::create_dir_all(source_root)
        .map_err(|error| format!("failed to create project source directory: {error}"))
}
