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
    ) -> Result<Vec<RemoteReportletEntry>, String> {
        let mut client = self.factory.connect(profile)?;
        list_reportlet_tree(client.as_mut(), &profile.remote_runtime_dir)
    }
}

fn list_reportlet_tree(
    client: &mut dyn super::remote_runtime::RemoteRuntimeClient,
    path: &str,
) -> Result<Vec<RemoteReportletEntry>, String> {
    client
        .list_entries(path)?
        .into_iter()
        .map(|entry| {
            let children = if entry.directory {
                list_reportlet_tree(client, &entry.path)?
            } else {
                Vec::new()
            };
            Ok(RemoteReportletEntry {
                name: entry.name,
                path: entry.path,
                kind: if entry.directory {
                    "directory".into()
                } else {
                    "file".into()
                },
                children,
            })
        })
        .collect()
}
