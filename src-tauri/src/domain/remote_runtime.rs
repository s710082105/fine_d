use super::fine_remote_bridge::{FineRemoteBridge, FineRemoteEntry};
use super::project_config::FineRemoteProfile;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDirectoryEntry {
    pub name: String,
    pub path: String,
    pub children: Vec<RemoteDirectoryEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteFileEntry {
    pub name: String,
    pub path: String,
    pub directory: bool,
    pub lock: Option<String>,
}

pub trait RemoteRuntimeClient: Send {
    fn list_directories(&mut self, path: &str) -> Result<Vec<RemoteDirectoryEntry>, String>;
    fn list_entries(&mut self, path: &str) -> Result<Vec<RemoteFileEntry>, String>;
    fn read_file(&mut self, path: &str) -> Result<Vec<u8>, String>;
    fn write_content(&mut self, remote_path: &str, content: &[u8]) -> Result<(), String>;
    fn download_tree(&mut self, remote_root: &str, local_root: &Path) -> Result<(), String>;
    fn upload_file(&mut self, local_path: &Path, remote_path: &str) -> Result<(), String>;
    fn delete_file(&mut self, remote_path: &str) -> Result<(), String>;
}

pub trait RemoteRuntimeClientFactory: Send + Sync {
    fn connect(&self, profile: &FineRemoteProfile) -> Result<Box<dyn RemoteRuntimeClient>, String>;
}

#[derive(Clone)]
pub struct ProtocolRemoteRuntimeFactory {
    bridge: FineRemoteBridge,
}

impl ProtocolRemoteRuntimeFactory {
    pub fn shared() -> Arc<dyn RemoteRuntimeClientFactory> {
        Arc::new(Self::default())
    }
}

impl Default for ProtocolRemoteRuntimeFactory {
    fn default() -> Self {
        Self {
            bridge: FineRemoteBridge::detect()
                .expect("failed to initialize fine remote bridge"),
        }
    }
}

impl RemoteRuntimeClientFactory for ProtocolRemoteRuntimeFactory {
    fn connect(&self, profile: &FineRemoteProfile) -> Result<Box<dyn RemoteRuntimeClient>, String> {
        Ok(Box::new(FineRemoteRuntimeClient {
            bridge: self.bridge.clone(),
            profile: profile.clone(),
        }))
    }
}

struct FineRemoteRuntimeClient {
    bridge: FineRemoteBridge,
    profile: FineRemoteProfile,
}

impl RemoteRuntimeClient for FineRemoteRuntimeClient {
    fn list_directories(&mut self, path: &str) -> Result<Vec<RemoteDirectoryEntry>, String> {
        let mut entries = self
            .list_entries(path)?
            .into_iter()
            .filter(|entry| entry.directory)
            .map(|entry| RemoteDirectoryEntry {
                name: entry.name,
                path: entry.path,
                children: Vec::new(),
            })
            .collect::<Vec<_>>();
        entries.sort_by(|left, right| left.path.cmp(&right.path));
        Ok(entries)
    }

    fn list_entries(&mut self, path: &str) -> Result<Vec<RemoteFileEntry>, String> {
        let mut entries = self
            .bridge
            .list_files(&self.profile, path)?
            .into_iter()
            .map(remote_file_entry)
            .collect::<Result<Vec<_>, _>>()?;
        entries.sort_by(|left, right| left.path.cmp(&right.path));
        Ok(entries)
    }

    fn read_file(&mut self, path: &str) -> Result<Vec<u8>, String> {
        self.bridge.read_file(&self.profile, path)
    }

    fn write_content(&mut self, remote_path: &str, content: &[u8]) -> Result<(), String> {
        self.bridge.write_file(&self.profile, remote_path, content)
    }

    fn download_tree(&mut self, remote_root: &str, local_root: &Path) -> Result<(), String> {
        fs::create_dir_all(local_root)
            .map_err(|error| format!("failed to create local directory: {error}"))?;
        self.download_directory(remote_root, local_root)
    }

    fn upload_file(&mut self, local_path: &Path, remote_path: &str) -> Result<(), String> {
        let content = fs::read(local_path)
            .map_err(|error| format!("failed to read local file for upload: {error}"))?;
        self.write_content(remote_path, &content)
    }

    fn delete_file(&mut self, remote_path: &str) -> Result<(), String> {
        self.bridge.delete_file(&self.profile, remote_path)
    }
}

impl FineRemoteRuntimeClient {
    fn download_directory(&self, remote_root: &str, local_root: &Path) -> Result<(), String> {
        for entry in self.bridge.list_files(&self.profile, remote_root)? {
            let file_name = remote_file_name(&entry)?;
            let local_path = local_root.join(file_name);
            if entry.directory {
                fs::create_dir_all(&local_path)
                    .map_err(|error| format!("failed to create local directory: {error}"))?;
                self.download_directory(&entry.path, &local_path)?;
                continue;
            }
            let content = self.bridge.read_file(&self.profile, &entry.path)?;
            fs::write(&local_path, content)
                .map_err(|error| format!("failed to write local bootstrap file: {error}"))?;
        }
        Ok(())
    }
}

fn remote_file_entry(entry: FineRemoteEntry) -> Result<RemoteFileEntry, String> {
    Ok(RemoteFileEntry {
        name: remote_file_name(&entry)?.into(),
        path: entry.path,
        directory: entry.directory,
        lock: entry.lock,
    })
}

fn remote_file_name(entry: &FineRemoteEntry) -> Result<&str, String> {
    entry
        .path
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("invalid remote path: {}", entry.path))
}
