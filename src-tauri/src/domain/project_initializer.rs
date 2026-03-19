use super::context_builder::build_runtime_context;
use super::project_git::ensure_project_git_sync;
use super::project_config::ProjectConfig;
use super::sync_bootstrap::{ProtocolRuntimeSyncBootstrapper, RuntimeSyncBootstrapper};
use std::path::Path;

const PROJECT_CODEX_DIR: &str = ".codex";
const DEFAULT_SKILLS: [&str; 5] = ["fr-create", "fr-cpt", "fr-fvs", "fr-db", "chrome-cdp"];

pub trait ProjectInitializer: Send + Sync {
    fn initialize(&self, project_dir: &Path, config: &ProjectConfig) -> Result<(), String>;
}

#[derive(Clone, Default)]
pub struct EmbeddedProjectInitializer {
    sync_bootstrapper: ProtocolRuntimeSyncBootstrapper,
}

impl ProjectInitializer for EmbeddedProjectInitializer {
    fn initialize(&self, project_dir: &Path, config: &ProjectConfig) -> Result<(), String> {
        let source_root = config.local_source_dir();
        self.sync_bootstrapper
            .replace_project_tree(source_root.as_path(), &config.sync)?;
        ensure_project_git_sync(project_dir, config)?;
        write_project_codex_context(project_dir, config)
    }
}

fn write_project_codex_context(project_dir: &Path, config: &ProjectConfig) -> Result<(), String> {
    let skills = DEFAULT_SKILLS
        .iter()
        .map(|skill| skill.to_string())
        .collect::<Vec<_>>();
    build_runtime_context(
        project_dir.join(PROJECT_CODEX_DIR).as_path(),
        config,
        &skills,
    )
    .map_err(|error| format!("failed to build project codex context: {error}"))
}
