use super::context_builder::build_runtime_context;
use super::project_config::ProjectConfig;
use super::project_git::ensure_project_git_sync;
use super::sync_bootstrap::{ProtocolRuntimeSyncBootstrapper, RuntimeSyncBootstrapper};
use std::fs;
use std::path::Path;

const PROJECT_CODEX_DIR: &str = ".codex";
const PROJECT_AGENTS_FILE: &str = "AGENTS.md";
const CODEX_PROJECT_CONTEXT_PATH: &str = ".codex/project-context.md";
const CODEX_PROJECT_RULES_PATH: &str = ".codex/project-rules.md";
const CODEX_MAPPINGS_PATH: &str = ".codex/mappings.json";
const CODEX_SKILLS_PATH: &str = ".codex/skills/";
const DEFAULT_SKILLS: [&str; 6] = [
    "fr-create",
    "fr-cpt",
    "fr-fvs",
    "fr-db",
    "chrome-cdp",
    "continuous-learning",
];

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
    let codex_dir = project_dir.join(PROJECT_CODEX_DIR);
    build_runtime_context(codex_dir.as_path(), config, &skills)
        .map_err(|error| format!("failed to build project codex context: {error}"))?;
    relocate_project_agents_file(project_dir)
}

fn relocate_project_agents_file(project_dir: &Path) -> Result<(), String> {
    let source = project_dir.join(PROJECT_CODEX_DIR).join(PROJECT_AGENTS_FILE);
    let target = project_dir.join(PROJECT_AGENTS_FILE);
    let content = fs::read_to_string(&source)
        .map_err(|error| format!("failed to read generated project AGENTS.md: {error}"))?;
    let rewritten = rewrite_project_agents_content(content.as_str());
    fs::write(&target, rewritten)
        .map_err(|error| format!("failed to write project root AGENTS.md: {error}"))?;
    fs::remove_file(&source)
        .map_err(|error| format!("failed to remove nested project AGENTS.md: {error}"))
}

fn rewrite_project_agents_content(content: &str) -> String {
    content
        .replace("`project-context.md`", &format!("`{CODEX_PROJECT_CONTEXT_PATH}`"))
        .replace("`project-rules.md`", &format!("`{CODEX_PROJECT_RULES_PATH}`"))
        .replace("`mappings.json`", &format!("`{CODEX_MAPPINGS_PATH}`"))
        .replace("`skills/`", &format!("`{CODEX_SKILLS_PATH}`"))
}
