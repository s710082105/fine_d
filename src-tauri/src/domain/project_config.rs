use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectConfig {
  pub style: StyleProfile,
  pub workspace: WorkspaceProfile,
  pub sync: SyncProfile,
  pub ai: AiProfile,
  pub mappings: Vec<ProjectMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StyleProfile {
  pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceProfile {
  pub name: String,
  pub root_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SyncProfile {
  pub protocol: SyncProtocol,
  pub local_source_dir: String,
  pub remote_runtime_dir: String,
  pub delete_propagation: bool,
  pub auto_sync_on_change: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SyncProtocol {
  Sftp,
  Ftp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AiProfile {
  pub provider: String,
  pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectMapping {
  pub local: String,
  pub remote: String,
}
