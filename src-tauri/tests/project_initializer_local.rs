use finereport_tauri_shell_lib::domain::project_config::ProjectConfig;
use finereport_tauri_shell_lib::domain::project_initializer::{
    EmbeddedProjectInitializer, ProjectInitializer,
};
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

#[derive(Clone)]
struct FakeBootstrapper {
    runtime_dir: PathBuf,
}

impl RuntimeSyncBootstrapper for FakeBootstrapper {
    fn replace_project_tree(
        &self,
        source_root: &Path,
        _: &finereport_tauri_shell_lib::domain::project_config::FineRemoteProfile,
    ) -> Result<(), String> {
        if source_root.exists() {
            fs::remove_dir_all(source_root).map_err(|error| error.to_string())?;
        }
        fs::create_dir_all(source_root).map_err(|error| error.to_string())?;
        copy_tree(&self.runtime_dir, source_root)
    }
}

fn copy_tree(source: &Path, target: &Path) -> Result<(), String> {
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if metadata.is_dir() {
            fs::create_dir_all(&target_path).map_err(|error| error.to_string())?;
            copy_tree(&source_path, &target_path)?;
            continue;
        }
        fs::copy(&source_path, &target_path)
            .map(|_| ())
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn build_config(project_dir: &PathBuf, runtime_dir: &PathBuf) -> ProjectConfig {
    let mut config = ProjectConfig::default();
    config.workspace.name = "demo-project".into();
    config.workspace.root_dir = project_dir.display().to_string();
    config.sync.designer_root = runtime_dir.display().to_string();
    config.sync.remote_runtime_dir = runtime_dir.display().to_string();
    config.preview.account = "designer".into();
    config.preview.password = "designer-pass".into();
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

    EmbeddedProjectInitializer::with_bootstrapper(Arc::new(FakeBootstrapper {
        runtime_dir: runtime_dir.clone(),
    }))
    .initialize(project_dir.as_path(), &build_config(&project_dir, &runtime_dir))
    .expect("initialize project");

    assert!(!source_dir.join("stale.txt").exists());
    assert_eq!(
        fs::read_to_string(source_dir.join("sales/report.cpt")).expect("read source file"),
        "demo-template"
    );
    assert!(project_dir.join("AGENTS.md").exists());
    assert!(project_dir.join(".codex/project-context.md").exists());
    assert!(project_dir.join(".codex/project-rules.md").exists());
    assert!(project_dir.join(".codex/mappings.json").exists());
    assert!(project_dir.join(".codex/project-sync.sh").exists());
}

#[test]
fn embedded_project_initializer_creates_missing_source_directory() {
    let project_dir = temp_dir("project_initializer_empty_project");
    let runtime_dir = temp_dir("project_initializer_empty_runtime");
    fs::create_dir_all(&runtime_dir).expect("create runtime dir");
    fs::write(runtime_dir.join("report.cpt"), "seed-template").expect("write runtime file");

    EmbeddedProjectInitializer::with_bootstrapper(Arc::new(FakeBootstrapper {
        runtime_dir: runtime_dir.clone(),
    }))
    .initialize(project_dir.as_path(), &build_config(&project_dir, &runtime_dir))
    .expect("initialize project with empty source");

    assert!(project_dir.join("reportlets").is_dir());
    assert_eq!(
        fs::read_to_string(project_dir.join("reportlets/report.cpt")).expect("read pulled file"),
        "seed-template"
    );
}

#[derive(Clone, Default)]
struct PanicBootstrapper;

impl RuntimeSyncBootstrapper for PanicBootstrapper {
    fn replace_project_tree(
        &self,
        _: &Path,
        _: &finereport_tauri_shell_lib::domain::project_config::FineRemoteProfile,
    ) -> Result<(), String> {
        panic!("replace_project_tree should not be called when only refreshing project context")
    }
}

#[test]
fn refresh_project_context_skips_remote_bootstrap() {
    let project_dir = temp_dir("project_initializer_refresh_only");
    let source_dir = project_dir.join("reportlets");
    fs::create_dir_all(&source_dir).expect("create source dir");
    fs::write(source_dir.join("local-only.cpt"), "keep-local").expect("write local file");

    let runtime_dir = temp_dir("project_initializer_refresh_runtime");
    fs::create_dir_all(&runtime_dir).expect("create runtime dir");

    EmbeddedProjectInitializer::with_bootstrapper(Arc::new(PanicBootstrapper))
        .refresh_project_context(project_dir.as_path(), &build_config(&project_dir, &runtime_dir))
        .expect("refresh project context");

    assert_eq!(
        fs::read_to_string(source_dir.join("local-only.cpt")).expect("read local file"),
        "keep-local"
    );
    assert!(project_dir.join("AGENTS.md").exists());
    assert!(project_dir.join(".codex/project-context.md").exists());
    assert!(project_dir.join(".codex/project-rules.md").exists());
    assert!(project_dir.join(".codex/mappings.json").exists());
    assert!(project_dir.join(".codex/project-sync.sh").exists());
}
