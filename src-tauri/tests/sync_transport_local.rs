use finereport_tauri_shell_lib::domain::project_config::SyncProfile;
use finereport_tauri_shell_lib::domain::sync_dispatcher::{ResolvedSyncTask, SyncAction};
use finereport_tauri_shell_lib::domain::sync_transport::{ProtocolSyncTransport, SyncTransport};
use serde_json::json;
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

fn build_local_profile(source_root: &PathBuf, runtime_root: &PathBuf) -> SyncProfile {
    serde_json::from_value(json!({
      "protocol": "local",
      "host": "",
      "port": 0,
      "username": "",
      "local_source_dir": source_root.display().to_string(),
      "remote_runtime_dir": runtime_root.display().to_string(),
      "delete_propagation": true,
      "auto_sync_on_change": true
    }))
    .expect("parse local sync profile")
}

#[test]
fn local_sync_transport_copies_and_deletes_runtime_files() {
    let source_root = temp_dir("local_sync_source");
    let runtime_root = temp_dir("local_sync_runtime");
    fs::create_dir_all(&source_root).expect("create source root");
    fs::create_dir_all(&runtime_root).expect("create runtime root");

    let local_path = source_root.join("sales/report.cpt");
    fs::create_dir_all(local_path.parent().expect("local file parent"))
        .expect("create local parent");
    fs::write(&local_path, "demo-template").expect("write local source file");

    let remote_path = runtime_root.join("sales/report.cpt");
    let profile = build_local_profile(&source_root, &runtime_root);
    let transport = ProtocolSyncTransport;

    transport
        .apply(
            &ResolvedSyncTask {
                session_id: "session-1".into(),
                action: SyncAction::Create,
                protocol: "local".into(),
                local_path: local_path.display().to_string(),
                remote_path: remote_path.display().to_string(),
            },
            &profile,
        )
        .expect("copy local runtime file");

    assert_eq!(
        fs::read_to_string(&remote_path).expect("read copied runtime file"),
        "demo-template"
    );

    transport
        .apply(
            &ResolvedSyncTask {
                session_id: "session-1".into(),
                action: SyncAction::Delete,
                protocol: "local".into(),
                local_path: local_path.display().to_string(),
                remote_path: remote_path.display().to_string(),
            },
            &profile,
        )
        .expect("delete local runtime file");

    assert!(!remote_path.exists());
}
