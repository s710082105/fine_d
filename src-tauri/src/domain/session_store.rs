use super::context_builder::build_runtime_context;
use super::project_config::ProjectConfig;
use serde::Serialize;
use std::fs;
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionManifest {
  pub session_id: String,
  pub project_id: String,
  pub config_version: String,
  pub embedded_agent_version: String,
  pub enabled_skills: Vec<String>,
  pub created_at: String,
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
  fs::create_dir_all(&logs_dir).map_err(|error| format!("failed to create logs directory: {error}"))?;
  fs::write(&transcript_path, "").map_err(|error| format!("failed to create transcript file: {error}"))?;
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

fn build_manifest(input: &SessionBootstrapInput) -> Result<SessionManifest, String> {
  Ok(SessionManifest {
    session_id: input.session_id.clone(),
    project_id: input.project_id.clone(),
    config_version: input.config_version.clone(),
    embedded_agent_version: EMBEDDED_AGENT_VERSION.into(),
    enabled_skills: input.enabled_skills.clone(),
    created_at: unix_timestamp()?,
  })
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
