use finereport_tauri_shell_lib::domain::project_config::ProjectConfig;
use finereport_tauri_shell_lib::domain::project_initializer::{
    EmbeddedProjectInitializer, ProjectInitializer,
};
use finereport_tauri_shell_lib::domain::project_git::uses_git_post_commit_sync;
use finereport_tauri_shell_lib::domain::sync_bootstrap::RuntimeSyncBootstrapper;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

fn temp_dir(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}_{nanos}"))
}

#[derive(Clone, Default)]
struct NoopBootstrapper;

impl RuntimeSyncBootstrapper for NoopBootstrapper {
    fn replace_project_tree(
        &self,
        source_root: &Path,
        _: &finereport_tauri_shell_lib::domain::project_config::FineRemoteProfile,
    ) -> Result<(), String> {
        fs::create_dir_all(source_root).map_err(|error| error.to_string())
    }
}

fn build_config(project_dir: &Path) -> ProjectConfig {
    let mut config = ProjectConfig::default();
    config.workspace.name = "demo-project".into();
    config.workspace.root_dir = project_dir.display().to_string();
    config.sync.designer_root = std::env::temp_dir().display().to_string();
    config.sync.remote_runtime_dir = "reportlets".into();
    config.preview.account = "preview-user".into();
    config.preview.password = "preview-pass".into();
    config
}

#[test]
fn project_initializer_creates_git_repo_hook_and_commit_rule() {
    let project_dir = temp_dir("project_git_repo");
    let config = build_config(project_dir.as_path());

    EmbeddedProjectInitializer::with_bootstrapper(Arc::new(NoopBootstrapper))
        .initialize(project_dir.as_path(), &config)
        .expect("initialize git-managed project");

    assert!(project_dir.join(".git").exists());
    let agents = fs::read_to_string(project_dir.join("AGENTS.md")).expect("read agents");
    assert!(agents.contains("必须在项目目录执行 `git add` 和 `git commit`"));
    assert!(agents.contains("根据系统类型选择"));

    if cfg!(windows) {
        assert!(!uses_git_post_commit_sync(project_dir.as_path()).expect("inspect git hook"));
        assert!(!project_dir.join(".git/hooks/post-commit").exists());
    } else {
        assert!(uses_git_post_commit_sync(project_dir.as_path()).expect("inspect git hook"));
        let hook = fs::read_to_string(project_dir.join(".git/hooks/post-commit"))
            .expect("read post-commit hook");
        assert!(hook.contains("FINEREPORT_POST_COMMIT_SYNC"));
        assert!(hook.contains("fine"));
        assert!(hook.contains("fine)"));
        assert!(hook.contains(
            "\"$SYNC_BIN\" --project-sync-hook \"$PROJECT_DIR\" \"$action\" \"$path\""
        ));
    }
}

#[test]
fn project_initializer_writes_platform_specific_sync_helper() {
    let project_dir = temp_dir("project_git_helper");
    let config = build_config(project_dir.as_path());

    EmbeddedProjectInitializer::with_bootstrapper(Arc::new(NoopBootstrapper))
        .initialize(project_dir.as_path(), &config)
        .expect("initialize git-managed project");

    if cfg!(windows) {
        assert!(project_dir.join(".codex/project-sync.cmd").exists());
        assert!(project_dir.join(".codex/fr-data.cmd").exists());
        assert!(!project_dir.join(".codex/project-sync.sh").exists());
    } else {
        assert!(project_dir.join(".codex/project-sync.sh").exists());
        assert!(project_dir.join(".codex/fr-data.sh").exists());
        assert!(!project_dir.join(".codex/project-sync.cmd").exists());
    }
}
