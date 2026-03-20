use finereport_tauri_shell_lib::domain::project_config::SyncProfile;
use finereport_tauri_shell_lib::domain::remote_directory_browser::RemoteDirectoryBrowser;
use finereport_tauri_shell_lib::domain::remote_runtime::{
    RemoteDirectoryEntry, RemoteRuntimeClient, RemoteRuntimeClientFactory,
};
use finereport_tauri_shell_lib::domain::sync_bootstrap::{
    ProtocolRuntimeSyncBootstrapper, RuntimeSyncBootstrapper,
};
use finereport_tauri_shell_lib::domain::sync_dispatcher::{ResolvedSyncTask, SyncAction};
use finereport_tauri_shell_lib::domain::sync_transport::{ProtocolSyncTransport, SyncTransport};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

fn temp_dir(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}_{nanos}"))
}

fn build_remote_profile() -> SyncProfile {
    serde_json::from_value(json!({
      "protocol": "sftp",
      "host": "127.0.0.1",
      "port": 22,
      "username": "deploy",
      "password": "deploy-pass",
      "remote_runtime_dir": "/srv/runtime/reportlets",
      "delete_propagation": true,
      "auto_sync_on_change": true
    }))
    .expect("parse remote sync profile")
}

#[derive(Clone, Default)]
struct FakeFactory {
    state: Arc<Mutex<FakeState>>,
}

#[derive(Default)]
struct FakeState {
    last_password: String,
    listed_paths: Vec<String>,
    uploaded_paths: Vec<String>,
    deleted_paths: Vec<String>,
}

struct FakeClient {
    state: Arc<Mutex<FakeState>>,
}

impl RemoteRuntimeClientFactory for FakeFactory {
    fn connect(&self, profile: &SyncProfile) -> Result<Box<dyn RemoteRuntimeClient>, String> {
        self.state
            .lock()
            .expect("lock fake state")
            .last_password = profile.password.clone();
        Ok(Box::new(FakeClient {
            state: Arc::clone(&self.state),
        }))
    }
}

impl RemoteRuntimeClient for FakeClient {
    fn list_directories(&mut self, path: &str) -> Result<Vec<RemoteDirectoryEntry>, String> {
        self.state
            .lock()
            .expect("lock fake state")
            .listed_paths
            .push(path.to_string());
        Ok(vec![RemoteDirectoryEntry {
            name: "reportlets".into(),
            path: format!("{path}/reportlets"),
            children: Vec::new(),
        }])
    }

    fn download_tree(&mut self, _remote_root: &str, local_root: &Path) -> Result<(), String> {
        fs::create_dir_all(local_root.join("sales")).map_err(|error| error.to_string())?;
        fs::write(local_root.join("sales/report.cpt"), "remote-template")
            .map_err(|error| error.to_string())
    }

    fn upload_file(&mut self, _local_path: &Path, remote_path: &str) -> Result<(), String> {
        self.state
            .lock()
            .expect("lock fake state")
            .uploaded_paths
            .push(remote_path.to_string());
        Ok(())
    }

    fn delete_file(&mut self, remote_path: &str) -> Result<(), String> {
        self.state
            .lock()
            .expect("lock fake state")
            .deleted_paths
            .push(remote_path.to_string());
        Ok(())
    }
}

#[test]
fn remote_directory_browser_lists_directories_via_factory() {
    let factory = FakeFactory::default();
    let browser = RemoteDirectoryBrowser::with_factory(Arc::new(factory.clone()));

    let entries = browser
        .list_directories(&build_remote_profile(), "/srv/runtime")
        .expect("list remote directories");

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].path, "/srv/runtime/reportlets");
    let state = factory.state.lock().expect("lock fake state");
    assert_eq!(state.last_password, "deploy-pass");
    assert_eq!(state.listed_paths, vec!["/srv/runtime"]);
}

#[test]
fn remote_runtime_bootstrap_downloads_tree_via_factory() {
    let source_root = temp_dir("remote_bootstrap_source");
    fs::create_dir_all(&source_root).expect("create source root");
    fs::write(source_root.join("stale.txt"), "stale").expect("write stale file");
    let bootstrapper = ProtocolRuntimeSyncBootstrapper::with_factory(Arc::new(
        FakeFactory::default(),
    ));

    bootstrapper
        .replace_project_tree(source_root.as_path(), &build_remote_profile())
        .expect("bootstrap remote tree");

    assert!(!source_root.join("stale.txt").exists());
    assert_eq!(
        fs::read_to_string(source_root.join("sales/report.cpt")).expect("read downloaded file"),
        "remote-template"
    );
}

#[test]
fn remote_sync_transport_uses_profile_password_for_upsert_and_delete() {
    let source_root = temp_dir("remote_transport_source");
    fs::create_dir_all(source_root.join("sales")).expect("create source dir");
    let local_path = source_root.join("sales/report.cpt");
    fs::write(&local_path, "demo-template").expect("write local file");
    let factory = FakeFactory::default();
    let transport = ProtocolSyncTransport::with_factory(Arc::new(factory.clone()));

    transport
        .apply(
            &ResolvedSyncTask {
                session_id: "session-1".into(),
                action: SyncAction::Create,
                protocol: "sftp".into(),
                local_path: local_path.display().to_string(),
                remote_path: "/srv/runtime/reportlets/sales/report.cpt".into(),
            },
            &build_remote_profile(),
        )
        .expect("upload remote file");
    transport
        .apply(
            &ResolvedSyncTask {
                session_id: "session-1".into(),
                action: SyncAction::Delete,
                protocol: "sftp".into(),
                local_path: local_path.display().to_string(),
                remote_path: "/srv/runtime/reportlets/sales/report.cpt".into(),
            },
            &build_remote_profile(),
        )
        .expect("delete remote file");

    let state = factory.state.lock().expect("lock fake state");
    assert_eq!(state.last_password, "deploy-pass");
    assert_eq!(
        state.uploaded_paths,
        vec!["/srv/runtime/reportlets/sales/report.cpt"]
    );
    assert_eq!(
        state.deleted_paths,
        vec!["/srv/runtime/reportlets/sales/report.cpt"]
    );
}
