use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const PROJECT_SOURCE_SUBDIR: &str = "reportlets";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct ProjectConfig {
    pub style: StyleProfile,
    pub workspace: WorkspaceProfile,
    pub data_connections: Vec<DataConnectionProfile>,
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
#[serde(rename_all = "lowercase")]
pub enum DbType {
    Mysql,
    Postgresql,
    Oracle,
    Sqlserver,
}

impl Default for DbType {
    fn default() -> Self {
        Self::Mysql
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct DataConnectionProfile {
    pub connection_name: String,
    pub db_type: DbType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
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
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub remote_runtime_dir: String,
    pub delete_propagation: bool,
    pub auto_sync_on_change: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SyncProtocol {
    Sftp,
    Ftp,
    Local,
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
        if self.protocol == SyncProtocol::Local {
            return Ok(());
        }
        if self.host.trim().is_empty() {
            return Err("host is required".into());
        }
        if self.port == 0 {
            return Err("port must be greater than zero".into());
        }
        if self.username.trim().is_empty() {
            return Err("username is required".into());
        }
        if self.password.trim().is_empty() {
            return Err("password is required".into());
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
            data_connections: Vec::new(),
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

impl Default for DataConnectionProfile {
    fn default() -> Self {
        Self {
            connection_name: String::new(),
            db_type: DbType::default(),
            host: String::new(),
            port: 3306,
            database: String::new(),
            username: String::new(),
            password: String::new(),
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
            host: String::new(),
            port: 22,
            username: String::new(),
            password: String::new(),
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
