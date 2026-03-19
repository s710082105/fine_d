use finereport_tauri_shell_lib::domain::event_bridge::{
    EventBridge, SessionEvent, SessionEventEmitter,
};
use finereport_tauri_shell_lib::domain::project_config::{
    ProjectConfig, ProjectMapping, SyncProfile,
};
use finereport_tauri_shell_lib::domain::sync_dispatcher::{ResolvedSyncTask, SyncManager};
use finereport_tauri_shell_lib::domain::sync_transport::SyncTransport;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Default)]
struct RecordingTransport {
    tasks: Mutex<Vec<ResolvedSyncTask>>,
}

impl SyncTransport for RecordingTransport {
    fn apply(&self, task: &ResolvedSyncTask, _: &SyncProfile) -> Result<(), String> {
        self.tasks
            .lock()
            .expect("lock transport tasks")
            .push(task.clone());
        Ok(())
    }
}

#[derive(Default)]
struct RecordingEmitter {
    events: Mutex<Vec<SessionEvent>>,
}

impl SessionEventEmitter for RecordingEmitter {
    fn emit(&self, event: &SessionEvent) -> Result<(), String> {
        self.events
            .lock()
            .expect("lock emitter events")
            .push(event.clone());
        Ok(())
    }
}

fn temp_source_root() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("sync_watch_{nanos}/reportlets"))
}

fn build_config(source_root: &PathBuf) -> ProjectConfig {
    let mut config = ProjectConfig::default();
    config.workspace.name = "demo".into();
    config.workspace.root_dir = source_root
        .parent()
        .expect("source root parent")
        .display()
        .to_string();
    config.sync.host = "files.example.com".into();
    config.sync.port = 22;
    config.sync.username = "deploy".into();
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
fn sync_manager_watches_local_changes_and_emits_sync_events() {
    let source_root = temp_source_root();
    fs::create_dir_all(&source_root).expect("create source root");
    let config = build_config(&source_root);
    let transport = Arc::new(RecordingTransport::default());
    let emitter = Arc::new(RecordingEmitter::default());
    let manager = SyncManager::new(transport.clone());
    let bridge = EventBridge::new(emitter.clone());

    manager
        .watch_session("session-1", &config, &bridge)
        .expect("watch session");
    thread::sleep(Duration::from_millis(200));

    let file_path = source_root.join("report.cpt");
    fs::write(&file_path, "demo").expect("write local file");

    let mut attempts = 0;
    loop {
        let tasks = transport.tasks.lock().expect("lock transport tasks");
        if tasks
            .iter()
            .any(|task| task.remote_path.ends_with("reportlets/report.cpt"))
        {
            break;
        }
        drop(tasks);
        attempts += 1;
        assert!(attempts < 40, "timed out waiting for sync task");
        thread::sleep(Duration::from_millis(50));
    }

    let events = emitter.events.lock().expect("lock emitter events");
    assert!(events.iter().any(|event| event.event_type
        == finereport_tauri_shell_lib::domain::event_bridge::SessionEventType::Sync));
    assert!(events.iter().any(|event| event.sync_path.as_deref()
        == Some("/srv/tomcat/webapps/webroot/WEB-INF/reportlets/report.cpt")));
}
