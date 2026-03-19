use finereport_tauri_shell_lib::domain::project_config::{ProjectConfig, SyncProtocol};
use finereport_tauri_shell_lib::domain::project_initializer::{
    EmbeddedProjectInitializer, ProjectInitializer,
};
use std::fs;
use std::path::Path;

#[test]
#[ignore = "manual real-path verification"]
fn real_path_project_initializer_from_env() {
    let project_dir = std::env::var("FINEREPORT_REAL_PROJECT_DIR")
        .expect("FINEREPORT_REAL_PROJECT_DIR is required");
    let runtime_dir = std::env::var("FINEREPORT_REAL_RUNTIME_DIR")
        .expect("FINEREPORT_REAL_RUNTIME_DIR is required");

    let mut config = ProjectConfig::default();
    config.workspace.name = "real-path-check".into();
    config.workspace.root_dir = project_dir.clone();
    config.sync.protocol = SyncProtocol::Local;
    config.sync.remote_runtime_dir = runtime_dir;

    EmbeddedProjectInitializer::default()
        .initialize(Path::new(&project_dir), &config)
        .expect("initialize real-path project");

    assert!(Path::new(&project_dir).join("AGENTS.md").exists());
    assert!(count_files(Path::new(&project_dir).join("reportlets").as_path()) > 0);
}

fn count_files(root: &Path) -> usize {
    let Ok(entries) = fs::read_dir(root) else {
        return 0;
    };
    let mut count = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.is_dir() {
            count += count_files(path.as_path());
            continue;
        }
        if metadata.is_file() {
            count += 1;
        }
    }
    count
}
