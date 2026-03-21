use finereport_tauri_shell_lib::commands::session::{
    start_session_in_project, CodexLaunchConfig, SessionRuntime, StartSessionRequest,
};
use finereport_tauri_shell_lib::domain::codex_process_manager::{
    CodexProcessManager, ProcessLaunchConfig,
};
use finereport_tauri_shell_lib::domain::event_bridge::{EventBridge, NullEventEmitter};
use finereport_tauri_shell_lib::domain::project_config::{
    ProjectConfig, ProjectMapping, WorkspaceProfile,
};
use finereport_tauri_shell_lib::domain::sync_dispatcher::SyncManager;
use finereport_tauri_shell_lib::test_support::{
    python_command, python_exit_script, python_print_line_script,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};

fn test_project_dir() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("session_bootstrap_{nanos}/projects/default"))
}

fn build_request(project_dir: &PathBuf) -> StartSessionRequest {
    let mut config = ProjectConfig::default();
    config.workspace = WorkspaceProfile {
        name: "demo".into(),
        root_dir: project_dir.display().to_string(),
    };
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

    let started_script = python_print_line_script("started");
    let (command, args) = python_command(started_script.as_str());
    StartSessionRequest {
        project_id: "default".into(),
        config_version: "v1".into(),
        first_message: "hello codex".into(),
        enabled_skills: vec!["fr-cpt".into(), "chrome-cdp".into()],
        config,
        codex: CodexLaunchConfig {
            command,
            args,
            working_dir: ".".into(),
        },
    }
}

fn wait_for_sync_cleanup(sync_manager: &SyncManager, session_id: &str) {
    for _ in 0..40 {
        if !sync_manager
            .is_watching(session_id)
            .expect("inspect sync watcher state")
        {
            return;
        }
        thread::sleep(Duration::from_millis(25));
    }
    panic!("timed out waiting for sync watcher cleanup");
}

fn wait_for_zero_watchers(sync_manager: &SyncManager) {
    for _ in 0..40 {
        if sync_manager.watcher_count().expect("inspect watcher count") == 0 {
            return;
        }
        thread::sleep(Duration::from_millis(25));
    }
    panic!("timed out waiting for watcher count to reach zero");
}

#[test]
fn session_start_persists_manifest() {
    let project_dir = test_project_dir();
    std::fs::create_dir_all(project_dir.join("reportlets")).expect("create source root");
    let request = build_request(&project_dir);
    let process_manager = CodexProcessManager::default();
    let bridge = EventBridge::new(Arc::new(NullEventEmitter));
    let started_script = python_print_line_script("started");
    let (command, args) = python_command(started_script.as_str());

    let response = start_session_in_project(
        project_dir.as_path(),
        &request,
        SessionRuntime {
            manager: &process_manager,
            bridge: &bridge,
            sync_manager: None,
        },
        ProcessLaunchConfig {
            command,
            args,
            env: HashMap::new(),
            working_dir: project_dir.clone(),
            exit_hook: None,
            stdout_hook: None,
        },
    )
    .expect("start session");

    let session_dir = project_dir.join("sessions").join(&response.session_id);
    assert!(session_dir.join("transcript.jsonl").exists());
    assert!(session_dir.join("session-manifest.json").exists());
    assert!(session_dir.join("context").exists());
    assert!(session_dir.join("context/AGENTS.md").exists());
    assert!(session_dir.join("context/project-context.md").exists());
    assert!(session_dir.join("context/project-rules.md").exists());
    assert!(session_dir.join("context/mappings.json").exists());
    assert!(session_dir.join("logs").exists());
}

#[test]
fn session_start_stops_sync_watcher_after_process_exit() {
    let project_dir = test_project_dir();
    std::fs::create_dir_all(project_dir.join("reportlets")).expect("create source root");
    let request = build_request(&project_dir);
    let process_manager = CodexProcessManager::default();
    let sync_manager = SyncManager::default();
    let bridge = EventBridge::new(Arc::new(NullEventEmitter));
    let exit_script = python_exit_script(0);
    let (command, args) = python_command(exit_script.as_str());

    let response = start_session_in_project(
        project_dir.as_path(),
        &request,
        SessionRuntime {
            manager: &process_manager,
            bridge: &bridge,
            sync_manager: Some(&sync_manager),
        },
        ProcessLaunchConfig {
            command,
            args,
            env: HashMap::new(),
            working_dir: project_dir.clone(),
            exit_hook: None,
            stdout_hook: None,
        },
    )
    .expect("start session");

    wait_for_sync_cleanup(&sync_manager, response.session_id.as_str());
}

#[test]
fn session_start_cleans_sync_watcher_when_process_launch_fails() {
    let project_dir = test_project_dir();
    std::fs::create_dir_all(project_dir.join("reportlets")).expect("create source root");
    let request = build_request(&project_dir);
    let process_manager = CodexProcessManager::default();
    let sync_manager = SyncManager::default();
    let bridge = EventBridge::new(Arc::new(NullEventEmitter));

    let error = start_session_in_project(
        project_dir.as_path(),
        &request,
        SessionRuntime {
            manager: &process_manager,
            bridge: &bridge,
            sync_manager: Some(&sync_manager),
        },
        ProcessLaunchConfig {
            command: "missing-codex-command".into(),
            args: Vec::new(),
            env: HashMap::new(),
            working_dir: project_dir.clone(),
            exit_hook: None,
            stdout_hook: None,
        },
    )
    .expect_err("missing process command must fail");

    assert!(error.contains("failed to spawn codex process"));
    wait_for_zero_watchers(&sync_manager);
}
