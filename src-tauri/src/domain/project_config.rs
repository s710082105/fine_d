use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const PROJECT_SOURCE_SUBDIR: &str = "reportlets";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct ProjectConfig {
    pub style: StyleProfile,
    pub workspace: WorkspaceProfile,
    pub preview: PreviewProfile,
    pub sync: SyncProfile,
    pub ai: AiProfile,
    pub mappings: Vec<ProjectMapping>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct StyleProfile {
    pub instructions: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct WorkspaceProfile {
    pub name: String,
    pub root_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct PreviewProfile {
    pub url: String,
    pub mode: PreviewMode,
    pub account: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PreviewMode {
    Embedded,
    External,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct SyncProfile {
    pub protocol: SyncProtocol,
    pub designer_root: String,
    pub remote_runtime_dir: String,
    pub delete_propagation: bool,
    pub auto_sync_on_change: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SyncProtocol {
    Fine,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FineRemoteProfile {
    pub protocol: SyncProtocol,
    pub designer_root: String,
    pub url: String,
    pub username: String,
    pub password: String,
    pub remote_runtime_dir: String,
    pub delete_propagation: bool,
    pub auto_sync_on_change: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct AiProfile {
    pub provider: String,
    pub model: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectMapping {
    pub local: String,
    pub remote: String,
}

impl ProjectConfig {
    pub fn validate(&self) -> Result<(), String> {
        self.style.validate()?;
        self.preview.validate()?;
        self.sync.validate()?;
        self.ai.validate()
    }

    pub fn local_source_dir(&self) -> PathBuf {
        join_workspace_child(&self.workspace.root_dir, PROJECT_SOURCE_SUBDIR)
    }

    pub fn fine_remote_profile(&self) -> Result<FineRemoteProfile, String> {
        let designer_root = self.sync.designer_root.trim();
        if designer_root.is_empty() {
            return Err("sync.designer_root is required".into());
        }
        let designer_path = Path::new(designer_root);
        if !designer_path.is_dir() {
            return Err(format!(
                "sync.designer_root does not exist or is not a directory: {}",
                designer_path.display()
            ));
        }
        let url = self.preview.url.trim();
        if url.is_empty() {
            return Err("preview.url is required".into());
        }
        let username = self.preview.account.trim();
        if username.is_empty() {
            return Err("preview.account is required".into());
        }
        if self.preview.password.trim().is_empty() {
            return Err("preview.password is required".into());
        }
        Ok(FineRemoteProfile {
            protocol: self.sync.protocol.clone(),
            designer_root: designer_root.into(),
            url: url.into(),
            username: username.into(),
            password: self.preview.password.clone(),
            remote_runtime_dir: self.sync.remote_runtime_dir.clone(),
            delete_propagation: self.sync.delete_propagation,
            auto_sync_on_change: self.sync.auto_sync_on_change,
        })
    }
}

impl StyleProfile {
    pub fn validate(&self) -> Result<(), String> {
        Ok(())
    }
}

impl PreviewProfile {
    pub fn validate(&self) -> Result<(), String> {
        if self.url.trim().is_empty() {
            return Err("preview.url is required".into());
        }
        Ok(())
    }
}

impl SyncProfile {
    pub fn validate(&self) -> Result<(), String> {
        if self.remote_runtime_dir.trim().is_empty() {
            return Err("remote_runtime_dir is required".into());
        }
        Ok(())
    }
}

impl AiProfile {
    pub fn validate(&self) -> Result<(), String> {
        Ok(())
    }
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            style: StyleProfile::default(),
            workspace: WorkspaceProfile::default(),
            preview: PreviewProfile::default(),
            sync: SyncProfile::default(),
            ai: AiProfile::default(),
            mappings: Vec::new(),
        }
    }
}

impl Default for StyleProfile {
    fn default() -> Self {
        Self {
            instructions: String::new(),
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

impl Default for PreviewProfile {
    fn default() -> Self {
        Self {
            url: "http://127.0.0.1:8075/webroot/decision".into(),
            mode: PreviewMode::default(),
            account: String::new(),
            password: String::new(),
        }
    }
}

impl Default for PreviewMode {
    fn default() -> Self {
        Self::Embedded
    }
}

impl Default for SyncProfile {
    fn default() -> Self {
        Self {
            protocol: SyncProtocol::default(),
            designer_root: String::new(),
            remote_runtime_dir: PROJECT_SOURCE_SUBDIR.into(),
            delete_propagation: false,
            auto_sync_on_change: true,
        }
    }
}

impl Default for SyncProtocol {
    fn default() -> Self {
        Self::Fine
    }
}

impl Default for AiProfile {
    fn default() -> Self {
        Self {
            provider: "openai".into(),
            model: "gpt-5".into(),
            api_key: String::new(),
        }
    }
}

fn join_workspace_child(root_dir: &str, child: &str) -> PathBuf {
    if root_dir.trim().is_empty() {
        return Path::new(child).to_path_buf();
    }
    Path::new(root_dir).join(child)
}
