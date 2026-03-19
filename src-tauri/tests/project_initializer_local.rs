use finereport_tauri_shell_lib::domain::project_config::{ProjectConfig, SyncProtocol};
use finereport_tauri_shell_lib::domain::project_initializer::{
    EmbeddedProjectInitializer, ProjectInitializer,
};
use finereport_tauri_shell_lib::domain::sync_bootstrap::{
    ProtocolRuntimeSyncBootstrapper, RuntimeSyncBootstrapper,
};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn temp_dir(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}_{nanos}"))
}

fn build_local_config(project_dir: &PathBuf, runtime_dir: &PathBuf) -> ProjectConfig {
    let mut config = ProjectConfig::default();
    config.workspace.name = "demo-project".into();
    config.workspace.root_dir = project_dir.display().to_string();
    config.sync.protocol = SyncProtocol::Local;
    config.sync.remote_runtime_dir = runtime_dir.display().to_string();
    config
}

#[test]
fn embedded_project_initializer_pulls_runtime_tree_and_builds_codex_context() {
    let project_dir = temp_dir("project_initializer_project");
    let source_dir = project_dir.join("reportlets");
    let runtime_dir = temp_dir("project_initializer_runtime");
    fs::create_dir_all(&source_dir).expect("create source dir");
    fs::create_dir_all(&runtime_dir).expect("create runtime dir");
    fs::write(source_dir.join("stale.txt"), "stale").expect("write stale source file");
    fs::create_dir_all(runtime_dir.join("sales")).expect("create runtime sales dir");
    fs::write(runtime_dir.join("sales/report.cpt"), "demo-template").expect("write runtime file");

    EmbeddedProjectInitializer::default()
        .initialize(
            project_dir.as_path(),
            &build_local_config(&project_dir, &runtime_dir),
        )
        .expect("initialize local project");

    assert!(!source_dir.join("stale.txt").exists());
    assert_eq!(
        fs::read_to_string(source_dir.join("sales/report.cpt")).expect("read source file"),
        "demo-template"
    );
    let agents = fs::read_to_string(project_dir.join("AGENTS.md")).expect("read project agents");
    assert!(agents.contains("`.codex/project-context.md`"));
    assert!(agents.contains("`.codex/project-rules.md`"));
    assert!(agents.contains("`.codex/mappings.json`"));
    assert!(agents.contains("`.codex/skills/`"));
    assert!(project_dir.join(".codex/project-context.md").exists());
    assert!(project_dir.join(".codex/project-rules.md").exists());
    assert!(project_dir.join(".codex/mappings.json").exists());
    assert!(project_dir
        .join(".codex/skills/chrome-cdp/SKILL.md")
        .exists());
}

#[test]
fn embedded_project_initializer_creates_missing_source_directory() {
    let project_dir = temp_dir("project_initializer_empty_project");
    let runtime_dir = temp_dir("project_initializer_empty_runtime");
    fs::create_dir_all(&runtime_dir).expect("create runtime dir");
    fs::write(runtime_dir.join("report.cpt"), "seed-template").expect("write runtime file");

    EmbeddedProjectInitializer::default()
        .initialize(
            project_dir.as_path(),
            &build_local_config(&project_dir, &runtime_dir),
        )
        .expect("initialize local project with empty source");

    assert!(project_dir.join("reportlets").is_dir());
    assert_eq!(
        fs::read_to_string(project_dir.join("reportlets/report.cpt")).expect("read pulled file"),
        "seed-template"
    );
    assert!(project_dir.join("AGENTS.md").exists());
}

#[test]
fn embedded_project_initializer_imports_latest_versioned_report_when_runtime_is_empty() {
    let project_dir = temp_dir("project_initializer_versioned_project");
    let runtime_dir = temp_dir("project_initializer_versioned_runtime");
    let versions_dir = runtime_dir
        .parent()
        .expect("runtime parent")
        .join("reportlets_versions");
    fs::create_dir_all(&runtime_dir).expect("create runtime dir");
    fs::create_dir_all(&versions_dir).expect("create versions dir");
    fs::write(versions_dir.join("订单列表.cpt.r"), "revision").expect("write revision file");
    fs::write(versions_dir.join("订单列表.cpt.v7"), "latest-version").expect("write version file");

    EmbeddedProjectInitializer::default()
        .initialize(
            project_dir.as_path(),
            &build_local_config(&project_dir, &runtime_dir),
        )
        .expect("initialize local project with versioned reports");

    assert_eq!(
        fs::read_to_string(project_dir.join("reportlets/订单列表.cpt"))
            .expect("read imported versioned report"),
        "latest-version"
    );
}

#[test]
fn runtime_sync_bootstrap_rejects_overlapping_local_directories() {
    let project_dir = temp_dir("project_initializer_overlap");
    let source_dir = project_dir.join("reportlets");
    fs::create_dir_all(&source_dir).expect("create overlapping source dir");

    let error = ProtocolRuntimeSyncBootstrapper
        .replace_project_tree(
            source_dir.as_path(),
            &build_local_config(&project_dir, &project_dir.join("reportlets")).sync,
        )
        .expect_err("overlapping local runtime dir must be rejected");

    assert!(error.contains("不能与项目源码目录相同"));
}
