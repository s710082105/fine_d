use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct ProjectConfig {
  pub style: StyleProfile,
  pub workspace: WorkspaceProfile,
  pub sync: SyncProfile,
  pub ai: AiProfile,
  pub mappings: Vec<ProjectMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct StyleProfile {
  pub theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct WorkspaceProfile {
  pub name: String,
  pub root_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct SyncProfile {
  pub protocol: SyncProtocol,
  pub host: String,
  pub port: u16,
  pub username: String,
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
#[serde(default)]
pub struct AiProfile {
  pub provider: String,
  pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectMapping {
  pub local: String,
  pub remote: String,
}

impl ProjectConfig {
  pub fn validate(&self) -> Result<(), String> {
    self.sync.validate()
  }
}

impl SyncProfile {
  pub fn validate(&self) -> Result<(), String> {
    if self.host.trim().is_empty() {
      return Err("host is required".into());
    }
    if self.port == 0 {
      return Err("port must be greater than zero".into());
    }
    if self.username.trim().is_empty() {
      return Err("username is required".into());
    }
    if self.local_source_dir.trim().is_empty() {
      return Err("local_source_dir is required".into());
    }
    if self.remote_runtime_dir.trim().is_empty() {
      return Err("remote_runtime_dir is required".into());
    }
    Ok(())
  }
}

impl Default for ProjectConfig {
  fn default() -> Self {
    Self {
      style: StyleProfile::default(),
      workspace: WorkspaceProfile::default(),
      sync: SyncProfile::default(),
      ai: AiProfile::default(),
      mappings: Vec::new(),
    }
  }
}

impl Default for StyleProfile {
  fn default() -> Self {
    Self {
      theme: "light".into(),
    }
  }
}

impl Default for WorkspaceProfile {
  fn default() -> Self {
    Self {
      name: "default".into(),
      root_dir: String::new(),
    }
  }
}

impl Default for SyncProfile {
  fn default() -> Self {
    Self {
      protocol: SyncProtocol::default(),
      host: String::new(),
      port: 22,
      username: String::new(),
      local_source_dir: String::new(),
      remote_runtime_dir: String::new(),
      delete_propagation: false,
      auto_sync_on_change: true,
    }
  }
}

impl Default for SyncProtocol {
  fn default() -> Self {
    Self::Sftp
  }
}

impl Default for AiProfile {
  fn default() -> Self {
    Self {
      provider: "openai".into(),
      model: "gpt-5".into(),
    }
  }
}
