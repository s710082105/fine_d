use finereport_tauri_shell_lib::domain::project_config::{FineRemoteProfile, SyncProtocol};
use finereport_tauri_shell_lib::domain::remote_directory_browser::RemoteDirectoryBrowser;
use finereport_tauri_shell_lib::domain::remote_reportlet_browser::RemoteReportletBrowser;
use finereport_tauri_shell_lib::domain::remote_runtime::{
    RemoteDirectoryEntry, RemoteFileEntry, RemoteRuntimeClient, RemoteRuntimeClientFactory,
};
use finereport_tauri_shell_lib::domain::remote_sync_guard::{
    prepare_remote_create, prepare_remote_edit,
};
use finereport_tauri_shell_lib::domain::sync_bootstrap::{
    ProtocolRuntimeSyncBootstrapper, RuntimeSyncBootstrapper,
};
use finereport_tauri_shell_lib::domain::sync_dispatcher::{ResolvedSyncTask, SyncAction};
use finereport_tauri_shell_lib::domain::sync_transport::{ProtocolSyncTransport, SyncTransport};
use std::collections::HashMap;
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

fn build_remote_profile() -> FineRemoteProfile {
    FineRemoteProfile {
        protocol: SyncProtocol::Fine,
        designer_root: "/Applications/FineReport".into(),
        url: "http://127.0.0.1:8075/webroot/decision".into(),
        username: "preview-user".into(),
        password: "preview-pass".into(),
        remote_runtime_dir: "/srv/runtime/reportlets".into(),
        delete_propagation: true,
        auto_sync_on_change: true,
    }
}

#[derive(Clone, Default)]
struct FakeFactory {
    state: Arc<Mutex<FakeState>>,
}

#[derive(Default)]
struct FakeState {
    last_password: String,
    listed_paths: Vec<String>,
    listed_entry_paths: Vec<String>,
    uploaded_paths: Vec<String>,
    deleted_paths: Vec<String>,
    entries: HashMap<String, FakeRemoteRecord>,
}

#[derive(Clone, Default)]
struct FakeRemoteRecord {
    directory: bool,
    content: Vec<u8>,
    lock: Option<String>,
}

struct FakeClient {
    state: Arc<Mutex<FakeState>>,
}

impl RemoteRuntimeClientFactory for FakeFactory {
    fn connect(&self, profile: &FineRemoteProfile) -> Result<Box<dyn RemoteRuntimeClient>, String> {
        self.state.lock().expect("lock fake state").last_password = profile.password.clone();
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
        let entries = self.list_entries(path)?;
        Ok(entries
            .into_iter()
            .filter(|entry| entry.directory)
            .map(|entry| RemoteDirectoryEntry {
                name: entry.name,
                path: entry.path,
                children: Vec::new(),
            })
            .collect())
    }

    fn list_entries(&mut self, path: &str) -> Result<Vec<RemoteFileEntry>, String> {
        let mut state = self.state.lock().expect("lock fake state");
        state.listed_entry_paths.push(path.to_string());
        Ok(list_child_entries(&state.entries, path))
    }

    fn read_file(&mut self, path: &str) -> Result<Vec<u8>, String> {
        let state = self.state.lock().expect("lock fake state");
        let Some(entry) = state.entries.get(path) else {
            return Err(format!("missing remote file: {path}"));
        };
        if entry.directory {
            return Err(format!("remote path is a directory: {path}"));
        }
        Ok(entry.content.clone())
    }

    fn write_content(&mut self, remote_path: &str, content: &[u8]) -> Result<(), String> {
        let mut state = self.state.lock().expect("lock fake state");
        state.uploaded_paths.push(remote_path.to_string());
        state.entries.insert(
            remote_path.to_string(),
            FakeRemoteRecord {
                directory: false,
                content: content.to_vec(),
                lock: None,
            },
        );
        Ok(())
    }

    fn download_tree(&mut self, _remote_root: &str, local_root: &Path) -> Result<(), String> {
        fs::create_dir_all(local_root.join("sales")).map_err(|error| error.to_string())?;
        fs::write(local_root.join("sales/report.cpt"), "remote-template")
            .map_err(|error| error.to_string())
    }

    fn upload_file(&mut self, _local_path: &Path, remote_path: &str) -> Result<(), String> {
        self.write_content(remote_path, b"")
    }

    fn delete_file(&mut self, remote_path: &str) -> Result<(), String> {
        let mut state = self.state.lock().expect("lock fake state");
        state.deleted_paths.push(remote_path.to_string());
        state.entries.remove(remote_path);
        Ok(())
    }
}

fn list_child_entries(
    entries: &HashMap<String, FakeRemoteRecord>,
    path: &str,
) -> Vec<RemoteFileEntry> {
    let mut items = entries
        .iter()
        .filter_map(|(entry_path, entry)| {
            if entry_path == path || parent_path(entry_path.as_str()) != path {
                return None;
            }
            Some(RemoteFileEntry {
                name: file_name(entry_path.as_str()),
                path: entry_path.clone(),
                directory: entry.directory,
                lock: entry.lock.clone(),
            })
        })
        .collect::<Vec<_>>();
    items.sort_by(|left, right| left.path.cmp(&right.path));
    items
}

fn parent_path(path: &str) -> &str {
    match path.rsplit_once('/') {
        Some((parent, _)) if !parent.is_empty() => parent,
        Some(_) => "/",
        None => "/",
    }
}

fn file_name(path: &str) -> String {
    path.rsplit('/').next().unwrap_or(path).to_string()
}

fn seed_remote_entries() -> HashMap<String, FakeRemoteRecord> {
    HashMap::from([
        (
            "/srv/runtime/reportlets".into(),
            FakeRemoteRecord {
                directory: true,
                content: Vec::new(),
                lock: None,
            },
        ),
        (
            "/srv/runtime/reportlets/sales".into(),
            FakeRemoteRecord {
                directory: true,
                content: Vec::new(),
                lock: None,
            },
        ),
        (
            "/srv/runtime/reportlets/sales/report.cpt".into(),
            FakeRemoteRecord {
                directory: false,
                content: b"remote-template".to_vec(),
                lock: None,
            },
        ),
    ])
}

#[test]
fn remote_directory_browser_lists_directories_via_factory() {
    let factory = FakeFactory {
        state: Arc::new(Mutex::new(FakeState {
            entries: seed_remote_entries(),
            ..Default::default()
        })),
    };
    let browser = RemoteDirectoryBrowser::with_factory(Arc::new(factory.clone()));

    let entries = browser
        .list_directories(&build_remote_profile(), "/srv/runtime")
        .expect("list remote directories");

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].path, "/srv/runtime/reportlets");
    let state = factory.state.lock().expect("lock fake state");
    assert_eq!(state.last_password, "preview-pass");
    assert_eq!(state.listed_paths, vec!["/srv/runtime"]);
}

#[test]
fn remote_runtime_bootstrap_downloads_tree_via_factory() {
    let source_root = temp_dir("remote_bootstrap_source");
    fs::create_dir_all(&source_root).expect("create source root");
    fs::write(source_root.join("stale.txt"), "stale").expect("write stale file");
    let bootstrapper =
        ProtocolRuntimeSyncBootstrapper::with_factory(Arc::new(FakeFactory::default()));

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
fn remote_reportlet_browser_lists_requested_directory_via_factory() {
    let factory = FakeFactory {
        state: Arc::new(Mutex::new(FakeState {
            entries: seed_remote_entries(),
            ..Default::default()
        })),
    };
    let browser = RemoteReportletBrowser::with_factory(Arc::new(factory.clone()));

    let entries = browser
        .list_reportlets(&build_remote_profile(), "/srv/runtime/reportlets")
        .expect("list remote reportlets");

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].name, "sales");
    assert_eq!(entries[0].kind, "directory");

    let child_entries = browser
        .list_reportlets(&build_remote_profile(), "/srv/runtime/reportlets/sales")
        .expect("list remote child reportlets");

    assert_eq!(child_entries.len(), 1);
    assert_eq!(child_entries[0].name, "report.cpt");
    assert_eq!(child_entries[0].kind, "file");
    let state = factory.state.lock().expect("lock fake state");
    assert_eq!(
        state.listed_entry_paths,
        vec!["/srv/runtime/reportlets", "/srv/runtime/reportlets/sales"]
    );
}

#[test]
fn remote_sync_transport_uses_profile_password_for_upsert_and_delete() {
    let source_root = temp_dir("remote_transport_source");
    fs::create_dir_all(source_root.join("sales")).expect("create source dir");
    let local_path = source_root.join("sales/report.cpt");
    fs::write(&local_path, "demo-template").expect("write local file");
    let factory = FakeFactory {
        state: Arc::new(Mutex::new(FakeState {
            entries: seed_remote_entries(),
            ..Default::default()
        })),
    };
    let transport = ProtocolSyncTransport::with_factory(Arc::new(factory.clone()));

    transport
        .apply(
            &ResolvedSyncTask {
                session_id: "session-1".into(),
                action: SyncAction::Create,
                protocol: "fine".into(),
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
                protocol: "fine".into(),
                local_path: local_path.display().to_string(),
                remote_path: "/srv/runtime/reportlets/sales/report.cpt".into(),
            },
            &build_remote_profile(),
        )
        .expect("delete remote file");

    let state = factory.state.lock().expect("lock fake state");
    assert_eq!(state.last_password, "preview-pass");
    assert_eq!(
        state.uploaded_paths,
        vec!["/srv/runtime/reportlets/sales/report.cpt"]
    );
    assert_eq!(
        state.deleted_paths,
        vec!["/srv/runtime/reportlets/sales/report.cpt"]
    );
}

#[test]
fn remote_sync_transport_rejects_locked_remote_file() {
    let source_root = temp_dir("remote_transport_locked");
    fs::create_dir_all(source_root.join("sales")).expect("create source dir");
    let local_path = source_root.join("sales/report.cpt");
    fs::write(&local_path, "demo-template").expect("write local file");
    let mut entries = seed_remote_entries();
    entries
        .get_mut("/srv/runtime/reportlets/sales/report.cpt")
        .unwrap()
        .lock = Some("designer-user".into());
    let factory = FakeFactory {
        state: Arc::new(Mutex::new(FakeState {
            entries,
            ..Default::default()
        })),
    };
    let transport = ProtocolSyncTransport::with_factory(Arc::new(factory));

    let error = transport
        .apply(
            &ResolvedSyncTask {
                session_id: "session-1".into(),
                action: SyncAction::Update,
                protocol: "fine".into(),
                local_path: local_path.display().to_string(),
                remote_path: "/srv/runtime/reportlets/sales/report.cpt".into(),
            },
            &build_remote_profile(),
        )
        .expect_err("locked file must reject sync");

    assert!(error.contains("远端文件已锁定"));
    assert!(error.contains("designer-user"));
}

#[test]
fn remote_prepare_create_rejects_duplicate_name() {
    let local_path = temp_dir("remote_prepare_duplicate").join("reportlets/new-report.cpt");
    let mut client = FakeClient {
        state: Arc::new(Mutex::new(FakeState {
            entries: {
                let mut entries = seed_remote_entries();
                entries.insert(
                    "/srv/runtime/reportlets/new-report.cpt".into(),
                    FakeRemoteRecord {
                        directory: false,
                        content: Vec::new(),
                        lock: None,
                    },
                );
                entries
            },
            ..Default::default()
        })),
    };

    let error = prepare_remote_create(
        &mut client,
        local_path.as_path(),
        "/srv/runtime/reportlets/new-report.cpt",
    )
    .expect_err("duplicate remote file must fail");

    assert!(error.contains("禁止重名创建"));
}

#[test]
fn remote_prepare_create_uploads_blank_cpt_template_instead_of_empty_file() {
    let local_root = temp_dir("remote_prepare_create");
    let local_path = local_root.join("reportlets/new-report.cpt");
    let state = Arc::new(Mutex::new(FakeState {
        entries: seed_remote_entries(),
        ..Default::default()
    }));
    let mut client = FakeClient {
        state: Arc::clone(&state),
    };

    prepare_remote_create(
        &mut client,
        local_path.as_path(),
        "/srv/runtime/reportlets/new-report.cpt",
    )
    .expect("prepare create should upload blank cpt template");

    let state = state.lock().expect("lock fake state");
    let uploaded = state
        .entries
        .get("/srv/runtime/reportlets/new-report.cpt")
        .expect("uploaded placeholder");

    assert!(!uploaded.content.is_empty());
    assert_eq!(
        uploaded.content,
        include_bytes!("../../embedded/skills/fr-create/assets/blank.cpt").to_vec()
    );
}

#[test]
fn remote_prepare_edit_pulls_latest_remote_content() {
    let local_root = temp_dir("remote_prepare_edit");
    let local_path = local_root.join("reportlets/sales/report.cpt");
    let mut client = FakeClient {
        state: Arc::new(Mutex::new(FakeState {
            entries: seed_remote_entries(),
            ..Default::default()
        })),
    };

    prepare_remote_edit(
        &mut client,
        local_path.as_path(),
        "/srv/runtime/reportlets/sales/report.cpt",
    )
    .expect("prepare edit should pull latest content");

    assert_eq!(
        fs::read_to_string(local_path).expect("read synced local file"),
        "remote-template"
    );
}
