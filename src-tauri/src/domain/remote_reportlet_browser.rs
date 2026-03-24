use super::project_config::FineRemoteProfile;
use super::remote_runtime::{ProtocolRemoteRuntimeFactory, RemoteRuntimeClientFactory};
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteReportletEntry {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub children: Vec<RemoteReportletEntry>,
}

#[derive(Clone)]
pub struct RemoteReportletBrowser {
    factory: Arc<dyn RemoteRuntimeClientFactory>,
}

impl Default for RemoteReportletBrowser {
    fn default() -> Self {
        Self::with_factory(ProtocolRemoteRuntimeFactory::shared())
    }
}

impl RemoteReportletBrowser {
    pub fn with_factory(factory: Arc<dyn RemoteRuntimeClientFactory>) -> Self {
        Self { factory }
    }

    pub fn list_reportlets(
        &self,
        profile: &FineRemoteProfile,
        path: &str,
    ) -> Result<Vec<RemoteReportletEntry>, String> {
        let mut client = self.factory.connect(profile)?;
        list_reportlet_entries(client.as_mut(), path)
    }
}

fn list_reportlet_entries(
    client: &mut dyn super::remote_runtime::RemoteRuntimeClient,
    path: &str,
) -> Result<Vec<RemoteReportletEntry>, String> {
    let entries = client
        .list_entries(path)?
        .into_iter()
        .map(|entry| RemoteReportletEntry {
            name: entry.name,
            path: entry.path,
            kind: if entry.directory {
                "directory".into()
            } else {
                "file".into()
            },
            children: Vec::new(),
        })
        .collect();
    Ok(entries)
}
