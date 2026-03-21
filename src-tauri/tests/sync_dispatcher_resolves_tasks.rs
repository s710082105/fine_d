use finereport_tauri_shell_lib::domain::project_config::{ProjectConfig, ProjectMapping};
use finereport_tauri_shell_lib::domain::sync_dispatcher::{resolve_sync_task, SyncAction};
use std::path::PathBuf;

fn project_root() -> PathBuf {
    std::env::temp_dir().join("sync-dispatcher-project")
}

fn build_config() -> ProjectConfig {
    let mut config = ProjectConfig::default();
    config.workspace.name = "default".into();
    config.workspace.root_dir = project_root().display().to_string();
    config.sync.host = "files.example.com".into();
    config.sync.port = 22;
    config.sync.username = "deploy".into();
    config.sync.password = "deploy-pass".into();
    config.sync.remote_runtime_dir = "/srv/tomcat/webapps/webroot/WEB-INF".into();
    config.sync.delete_propagation = true;
    config.sync.auto_sync_on_change = true;
    config.mappings = vec![ProjectMapping {
        local: "reportlets".into(),
        remote: "reportlets".into(),
    }];
    config
}

#[test]
fn resolve_sync_task_maps_local_file_to_runtime_target() {
    let config = build_config();
    let local_path = project_root().join("reportlets/sales/report.cpt");
    let task = resolve_sync_task(
        "session-1",
        &config,
        local_path.as_path(),
        SyncAction::Update,
    )
    .expect("resolve sync task");

    assert_eq!(task.protocol, "sftp");
    assert_eq!(
        task.remote_path,
        "/srv/tomcat/webapps/webroot/WEB-INF/reportlets/sales/report.cpt"
    );
    assert_eq!(task.action, SyncAction::Update);
}

#[test]
fn resolve_sync_task_rejects_paths_outside_source_dir() {
    let config = build_config();
    let local_path = std::env::temp_dir().join("sync-dispatcher-other/report.cpt");
    let error = resolve_sync_task(
        "session-1",
        &config,
        local_path.as_path(),
        SyncAction::Create,
    )
    .expect_err("path outside source dir must fail");

    assert!(error.contains("outside project source dir"));
}
