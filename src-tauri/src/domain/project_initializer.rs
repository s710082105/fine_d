use super::context_builder::build_runtime_context;
use super::project_config::ProjectConfig;
use super::project_git::{ensure_project_git_sync, resolve_sync_binary_path, to_posix_path};
use super::sync_bootstrap::{ProtocolRuntimeSyncBootstrapper, RuntimeSyncBootstrapper};
use std::fs;
use std::path::Path;
use std::sync::Arc;

const PROJECT_CODEX_DIR: &str = ".codex";
const PROJECT_AGENTS_FILE: &str = "AGENTS.md";
const CODEX_PROJECT_CONTEXT_PATH: &str = ".codex/project-context.md";
const CODEX_PROJECT_RULES_PATH: &str = ".codex/project-rules.md";
const CODEX_MAPPINGS_PATH: &str = ".codex/mappings.json";
const CODEX_SKILLS_PATH: &str = ".codex/skills/";
const CODEX_PROJECT_SYNC_HELPER_PATH: &str = ".codex/project-sync.sh";
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

#[derive(Clone)]
pub struct EmbeddedProjectInitializer {
    sync_bootstrapper: Arc<dyn RuntimeSyncBootstrapper>,
}

impl Default for EmbeddedProjectInitializer {
    fn default() -> Self {
        Self::with_bootstrapper(Arc::new(ProtocolRuntimeSyncBootstrapper::default()))
    }
}

impl EmbeddedProjectInitializer {
    pub fn with_bootstrapper(bootstrapper: Arc<dyn RuntimeSyncBootstrapper>) -> Self {
        Self {
            sync_bootstrapper: bootstrapper,
        }
    }
}

impl ProjectInitializer for EmbeddedProjectInitializer {
    fn initialize(&self, project_dir: &Path, config: &ProjectConfig) -> Result<(), String> {
        let source_root = config.local_source_dir();
        let profile = config.fine_remote_profile()?;
        self.sync_bootstrapper
            .replace_project_tree(source_root.as_path(), &profile)?;
        self.refresh_project_context(project_dir, config)
    }
}

impl EmbeddedProjectInitializer {
    pub fn refresh_project_context(
        &self,
        project_dir: &Path,
        config: &ProjectConfig,
    ) -> Result<(), String> {
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
    write_project_sync_helper(project_dir)?;
    relocate_project_agents_file(project_dir)
}

fn relocate_project_agents_file(project_dir: &Path) -> Result<(), String> {
    let source = project_dir
        .join(PROJECT_CODEX_DIR)
        .join(PROJECT_AGENTS_FILE);
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
        .replace(
            "`project-context.md`",
            &format!("`{CODEX_PROJECT_CONTEXT_PATH}`"),
        )
        .replace(
            "`project-rules.md`",
            &format!("`{CODEX_PROJECT_RULES_PATH}`"),
        )
        .replace("`mappings.json`", &format!("`{CODEX_MAPPINGS_PATH}`"))
        .replace("`skills/`", &format!("`{CODEX_SKILLS_PATH}`"))
}

fn write_project_sync_helper(project_dir: &Path) -> Result<(), String> {
    let helper_path = project_dir.join(CODEX_PROJECT_SYNC_HELPER_PATH);
    let helper = render_project_sync_helper(project_dir);
    fs::write(&helper_path, helper)
        .map_err(|error| format!("failed to write project sync helper: {error}"))?;
    set_executable(&helper_path)
}

fn render_project_sync_helper(project_dir: &Path) -> String {
    format!(
        "#!/bin/sh\nset -eu\nPROJECT_DIR='{project_dir}'\nSYNC_BIN='{sync_bin}'\ncommand=\"${{1-}}\"\nrelative_path=\"${{2-}}\"\ncase \"$command\" in\n  prepare-create)\n    exec \"$SYNC_BIN\" --project-sync-prepare-create \"$PROJECT_DIR\" \"$relative_path\"\n    ;;\n  prepare-edit)\n    exec \"$SYNC_BIN\" --project-sync-prepare-edit \"$PROJECT_DIR\" \"$relative_path\"\n    ;;\n  *)\n    printf '%s\\n' 'usage: ./.codex/project-sync.sh prepare-create|prepare-edit reportlets/<name>.cpt' >&2\n    exit 1\n    ;;\nesac\n",
        project_dir = to_posix_path(project_dir.to_string_lossy().as_ref()),
        sync_bin = to_posix_path(resolve_sync_binary_path().to_string_lossy().as_ref())
    )
}

fn set_executable(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = fs::metadata(path)
            .map_err(|error| format!("failed to stat project sync helper: {error}"))?;
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions)
            .map_err(|error| format!("failed to mark project sync helper executable: {error}"))
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(())
    }
}
