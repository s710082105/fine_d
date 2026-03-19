use finereport_tauri_shell_lib::domain::project_config::{ProjectConfig, SyncProtocol};
use finereport_tauri_shell_lib::domain::project_git::uses_git_post_commit_sync;
use finereport_tauri_shell_lib::domain::project_initializer::{
    EmbeddedProjectInitializer, ProjectInitializer,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn temp_dir(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}_{nanos}"))
}

fn build_local_config(project_dir: &Path, runtime_dir: &Path) -> ProjectConfig {
    let mut config = ProjectConfig::default();
    config.workspace.name = "demo-project".into();
    config.workspace.root_dir = project_dir.display().to_string();
    config.sync.protocol = SyncProtocol::Local;
    config.sync.remote_runtime_dir = runtime_dir.display().to_string();
    config
}

fn run_git(project_dir: &Path, args: &[&str]) {
    let output = Command::new("git")
        .arg("-C")
        .arg(project_dir)
        .args(args)
        .env("GIT_AUTHOR_NAME", "FineReport Test")
        .env("GIT_AUTHOR_EMAIL", "finereport@example.com")
        .env("GIT_COMMITTER_NAME", "FineReport Test")
        .env("GIT_COMMITTER_EMAIL", "finereport@example.com")
        .output()
        .expect("run git command");
    assert!(
        output.status.success(),
        "git command failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn project_initializer_creates_git_repo_hook_and_commit_rule() {
    let project_dir = temp_dir("project_git_repo");
    let runtime_dir = temp_dir("project_git_runtime");
    fs::create_dir_all(&runtime_dir).expect("create runtime dir");

    EmbeddedProjectInitializer::default()
        .initialize(
            project_dir.as_path(),
            &build_local_config(project_dir.as_path(), runtime_dir.as_path()),
        )
        .expect("initialize git-managed project");

    assert!(uses_git_post_commit_sync(project_dir.as_path()).expect("inspect git hook"));
    assert!(project_dir.join(".git").exists());
    let hook = fs::read_to_string(project_dir.join(".git/hooks/post-commit"))
        .expect("read post-commit hook");
    let agents = fs::read_to_string(project_dir.join(".codex/AGENTS.md")).expect("read agents");

    assert!(hook.contains("FINEREPORT_POST_COMMIT_SYNC"));
    assert!(agents.contains("必须在项目目录执行 `git add` 和 `git commit`"));
    assert!(agents.contains("`.cpt`、`.fvs` 的变更"));
}

#[test]
fn post_commit_hook_syncs_only_reportlet_cpt_and_fvs_changes() {
    let project_dir = temp_dir("project_git_sync_project");
    let runtime_dir = temp_dir("project_git_sync_runtime");
    fs::create_dir_all(&runtime_dir).expect("create runtime dir");

    EmbeddedProjectInitializer::default()
        .initialize(
            project_dir.as_path(),
            &build_local_config(project_dir.as_path(), runtime_dir.as_path()),
        )
        .expect("initialize git-managed project");

    let source_dir = project_dir.join("reportlets");
    fs::create_dir_all(&source_dir).expect("create source dir");
    fs::write(source_dir.join("微信用户列表.cpt"), "v1").expect("write cpt");
    fs::write(source_dir.join("dashboard.fvs"), "fvs-v1").expect("write fvs");
    fs::write(source_dir.join("notes.txt"), "ignore-me").expect("write txt");

    run_git(project_dir.as_path(), &["add", "."]);
    run_git(project_dir.as_path(), &["commit", "-m", "feat: initial reports"]);

    assert_eq!(
        fs::read_to_string(runtime_dir.join("微信用户列表.cpt")).expect("read synced cpt"),
        "v1"
    );
    assert_eq!(
        fs::read_to_string(runtime_dir.join("dashboard.fvs")).expect("read synced fvs"),
        "fvs-v1"
    );
    assert!(!runtime_dir.join("notes.txt").exists());

    fs::remove_file(source_dir.join("微信用户列表.cpt")).expect("delete cpt");
    fs::write(source_dir.join("dashboard.fvs"), "fvs-v2").expect("update fvs");
    fs::write(source_dir.join("notes.txt"), "still-ignore").expect("update txt");

    run_git(project_dir.as_path(), &["add", "-A"]);
    run_git(project_dir.as_path(), &["commit", "-m", "fix: update reports"]);

    assert!(!runtime_dir.join("微信用户列表.cpt").exists());
    assert_eq!(
        fs::read_to_string(runtime_dir.join("dashboard.fvs")).expect("read updated fvs"),
        "fvs-v2"
    );
    assert!(!runtime_dir.join("notes.txt").exists());
}
