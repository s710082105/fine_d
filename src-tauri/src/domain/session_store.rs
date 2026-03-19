use super::context_builder::build_runtime_context;
use super::project_config::ProjectConfig;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MANIFEST_FILE: &str = "session-manifest.json";
const TRANSCRIPT_FILE: &str = "transcript.jsonl";
const EMBEDDED_AGENT_VERSION: &str = "0.1.0";

#[derive(Debug, Clone)]
pub struct SessionBootstrapInput {
    pub project_id: String,
    pub session_id: String,
    pub config_version: String,
    pub config: ProjectConfig,
    pub enabled_skills: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct SessionBootstrapResult {
    pub session_dir: PathBuf,
    pub context_dir: PathBuf,
    pub transcript_path: PathBuf,
    pub logs_dir: PathBuf,
    pub manifest_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionManifest {
    pub session_id: String,
    pub codex_session_id: Option<String>,
    pub project_id: String,
    pub config_version: String,
    pub embedded_agent_version: String,
    pub enabled_skills: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptLine {
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub config_version: String,
}

pub fn bootstrap_session(
    project_dir: &Path,
    input: &SessionBootstrapInput,
) -> Result<SessionBootstrapResult, String> {
    let session_dir = project_dir.join("sessions").join(&input.session_id);
    let context_dir = session_dir.join("context");
    let logs_dir = session_dir.join("logs");
    let transcript_path = session_dir.join(TRANSCRIPT_FILE);
    let manifest_path = session_dir.join(MANIFEST_FILE);
    fs::create_dir_all(&context_dir)
        .map_err(|error| format!("failed to create context directory: {error}"))?;
    fs::create_dir_all(&logs_dir)
        .map_err(|error| format!("failed to create logs directory: {error}"))?;
    fs::write(&transcript_path, "")
        .map_err(|error| format!("failed to create transcript file: {error}"))?;
    build_runtime_context(&context_dir, &input.config, &input.enabled_skills)
        .map_err(|error| format!("failed to build session context: {error}"))?;

    let manifest = build_manifest(input)?;
    write_manifest(&manifest_path, &manifest)?;
    Ok(SessionBootstrapResult {
        session_dir,
        context_dir,
        transcript_path,
        logs_dir,
        manifest_path,
    })
}

pub fn refresh_session_context(
    project_dir: &Path,
    input: &SessionBootstrapInput,
) -> Result<(), String> {
    let session_dir = project_dir.join("sessions").join(&input.session_id);
    if !session_dir.exists() {
        return Err(format!(
            "session directory does not exist: {}",
            session_dir.display()
        ));
    }

    let context_dir = session_dir.join("context");
    fs::create_dir_all(&context_dir)
        .map_err(|error| format!("failed to create context directory: {error}"))?;
    build_runtime_context(&context_dir, &input.config, &input.enabled_skills)
        .map_err(|error| format!("failed to refresh session context: {error}"))?;

    let manifest_path = session_dir.join(MANIFEST_FILE);
    let manifest = refresh_manifest(&manifest_path, input)?;
    write_manifest(&manifest_path, &manifest)
}

pub fn append_transcript_entry(
    path: &Path,
    role: &str,
    content: &str,
    config_version: &str,
) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .append(true)
        .open(path)
        .map_err(|error| format!("failed to open transcript: {error}"))?;
    let line = TranscriptLine {
        role: role.into(),
        content: content.into(),
        timestamp: unix_timestamp()?,
        config_version: config_version.into(),
    };
    let payload = serde_json::to_string(&line)
        .map_err(|error| format!("failed to serialize transcript: {error}"))?;
    writeln!(file, "{payload}").map_err(|error| format!("failed to write transcript: {error}"))
}

pub fn session_manifest_path(project_dir: &Path, session_id: &str) -> PathBuf {
    project_dir
        .join("sessions")
        .join(session_id)
        .join(MANIFEST_FILE)
}

pub fn session_transcript_path(project_dir: &Path, session_id: &str) -> PathBuf {
    project_dir
        .join("sessions")
        .join(session_id)
        .join(TRANSCRIPT_FILE)
}

pub fn set_codex_session_id(path: &Path, codex_session_id: &str) -> Result<(), String> {
    let mut manifest = read_manifest(path)?;
    if manifest.codex_session_id.as_deref() == Some(codex_session_id) {
        return Ok(());
    }
    if let Some(existing) = manifest.codex_session_id.as_deref() {
        return Err(format!(
            "codex session id mismatch: existing={existing}, incoming={codex_session_id}"
        ));
    }
    manifest.codex_session_id = Some(codex_session_id.into());
    write_manifest(path, &manifest)
}

fn build_manifest(input: &SessionBootstrapInput) -> Result<SessionManifest, String> {
    Ok(SessionManifest {
        session_id: input.session_id.clone(),
        codex_session_id: None,
        project_id: input.project_id.clone(),
        config_version: input.config_version.clone(),
        embedded_agent_version: EMBEDDED_AGENT_VERSION.into(),
        enabled_skills: input.enabled_skills.clone(),
        created_at: unix_timestamp()?,
    })
}

fn refresh_manifest(path: &Path, input: &SessionBootstrapInput) -> Result<SessionManifest, String> {
    let existing = read_manifest(path)?;
    Ok(SessionManifest {
        session_id: input.session_id.clone(),
        codex_session_id: existing.codex_session_id,
        project_id: input.project_id.clone(),
        config_version: input.config_version.clone(),
        embedded_agent_version: existing.embedded_agent_version,
        enabled_skills: input.enabled_skills.clone(),
        created_at: existing.created_at,
    })
}

fn read_manifest(path: &Path) -> Result<SessionManifest, String> {
    let payload = fs::read_to_string(path)
        .map_err(|error| format!("failed to read session manifest: {error}"))?;
    serde_json::from_str(&payload)
        .map_err(|error| format!("failed to parse session manifest: {error}"))
}

fn write_manifest(path: &Path, manifest: &SessionManifest) -> Result<(), String> {
    let payload = serde_json::to_string_pretty(manifest)
        .map_err(|error| format!("failed to serialize session manifest: {error}"))?;
    fs::write(path, payload).map_err(|error| format!("failed to write session manifest: {error}"))
}

fn unix_timestamp() -> Result<String, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to get unix timestamp: {error}"))?;
    Ok(now.as_secs().to_string())
}
