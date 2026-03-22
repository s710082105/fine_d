use super::project_config::FineRemoteProfile;
use super::remote_runtime::{
    ProtocolRemoteRuntimeFactory, RemoteDirectoryEntry, RemoteRuntimeClientFactory,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct RemoteDirectoryBrowser {
    factory: Arc<dyn RemoteRuntimeClientFactory>,
}

impl Default for RemoteDirectoryBrowser {
    fn default() -> Self {
        Self::with_factory(ProtocolRemoteRuntimeFactory::shared())
    }
}

impl RemoteDirectoryBrowser {
    pub fn with_factory(factory: Arc<dyn RemoteRuntimeClientFactory>) -> Self {
        Self { factory }
    }

    pub fn list_directories(
        &self,
        profile: &FineRemoteProfile,
        path: &str,
    ) -> Result<Vec<RemoteDirectoryEntry>, String> {
        let mut client = self.factory.connect(profile)?;
        client.list_directories(path)
    }
}
