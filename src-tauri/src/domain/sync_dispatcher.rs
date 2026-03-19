use super::event_bridge::EventBridge;
use super::project_config::{ProjectConfig, SyncProtocol};
use super::sync_transport::{ProtocolSyncTransport, SyncTransport};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::SystemTime;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyncAction {
    Create,
    Update,
    Delete,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedSyncTask {
    pub session_id: String,
    pub action: SyncAction,
    pub protocol: String,
    pub local_path: String,
    pub remote_path: String,
}

#[derive(Clone)]
pub struct SyncManager {
    transport: Arc<dyn SyncTransport>,
    watchers: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl Default for SyncManager {
    fn default() -> Self {
        Self::new(ProtocolSyncTransport::shared())
    }
}

impl SyncManager {
    pub fn new(transport: Arc<dyn SyncTransport>) -> Self {
        Self {
            transport,
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn watch_session(
        &self,
        session_id: &str,
        config: &ProjectConfig,
        bridge: &EventBridge,
    ) -> Result<(), String> {
        if !config.sync.auto_sync_on_change {
            return Ok(());
        }
        let watch_root = config.local_source_dir();
        if !watch_root.exists() {
            return Err(format!(
                "project source dir does not exist: {}",
                watch_root.display()
            ));
        }
        let config = config.clone();
        let bridge = bridge.clone();
        let transport = Arc::clone(&self.transport);
        let session_id_string = session_id.to_string();
        let active = Arc::new(AtomicBool::new(true));
        let mut lock = self
            .watchers
            .lock()
            .map_err(|error| format!("failed to acquire sync watcher lock: {error}"))?;
        if let Some(previous) = lock.insert(session_id.to_string(), active.clone()) {
            previous.store(false, Ordering::Relaxed);
        }
        drop(lock);

        thread::spawn(move || {
            let mut previous_snapshot = scan_files(&watch_root);
            while active.load(Ordering::Relaxed) {
                thread::sleep(std::time::Duration::from_millis(250));
                let current_snapshot = scan_files(&watch_root);
                sync_snapshot_diff(
                    &session_id_string,
                    &config,
                    &bridge,
                    transport.as_ref(),
                    &previous_snapshot,
                    &current_snapshot,
                );
                previous_snapshot = current_snapshot;
            }
        });
        Ok(())
    }

    pub fn stop_session(&self, session_id: &str) {
        let Ok(mut lock) = self.watchers.lock() else {
            return;
        };
        let Some(active) = lock.remove(session_id) else {
            return;
        };
        active.store(false, Ordering::Relaxed);
    }

    pub fn is_watching(&self, session_id: &str) -> Result<bool, String> {
        let lock = self
            .watchers
            .lock()
            .map_err(|error| format!("failed to acquire sync watcher lock: {error}"))?;
        Ok(lock.contains_key(session_id))
    }

    pub fn watcher_count(&self) -> Result<usize, String> {
        let lock = self
            .watchers
            .lock()
            .map_err(|error| format!("failed to acquire sync watcher lock: {error}"))?;
        Ok(lock.len())
    }
}

pub fn resolve_sync_task(
    session_id: &str,
    config: &ProjectConfig,
    local_path: &Path,
    action: SyncAction,
) -> Result<ResolvedSyncTask, String> {
    let source_root = config.local_source_dir();
    let relative_path = local_path.strip_prefix(&source_root).map_err(|_| {
        format!(
            "path is outside project source dir: {}",
            local_path.display()
        )
    })?;
    let remote_root = resolve_remote_root(config, &source_root);
    let remote_path = remote_root.join(relative_path);

    Ok(ResolvedSyncTask {
        session_id: session_id.into(),
        action,
        protocol: protocol_text(&config.sync.protocol).into(),
        local_path: local_path.display().to_string(),
        remote_path: remote_path.display().to_string(),
    })
}

fn resolve_remote_root(config: &ProjectConfig, source_root: &Path) -> PathBuf {
    let mapping_key = source_root
        .file_name()
        .map(|value| value.to_string_lossy().to_string());
    let remote_root = PathBuf::from(&config.sync.remote_runtime_dir);
    let Some(mapping_key) = mapping_key else {
        return remote_root;
    };
    let Some(mapping) = config
        .mappings
        .iter()
        .find(|candidate| candidate.local == mapping_key)
    else {
        return remote_root;
    };
    remote_root.join(&mapping.remote)
}

fn scan_files(root: &Path) -> HashMap<PathBuf, SystemTime> {
    let mut files = HashMap::new();
    collect_files(root, &mut files);
    files
}

fn collect_files(root: &Path, files: &mut HashMap<PathBuf, SystemTime>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry_result in entries {
        let Ok(entry) = entry_result else {
            continue;
        };
        let path = entry.path();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.is_dir() {
            collect_files(&path, files);
            continue;
        }
        if !metadata.is_file() {
            continue;
        }
        let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        files.insert(path, modified);
    }
}

fn sync_snapshot_diff(
    session_id: &str,
    config: &ProjectConfig,
    bridge: &EventBridge,
    transport: &dyn SyncTransport,
    previous: &HashMap<PathBuf, SystemTime>,
    current: &HashMap<PathBuf, SystemTime>,
) {
    for (path, modified) in current {
        let action = match previous.get(path) {
            None => Some(SyncAction::Create),
            Some(previous_modified) if previous_modified != modified => Some(SyncAction::Update),
            _ => None,
        };
        if let Some(action) = action {
            apply_sync_change(
                session_id,
                config,
                bridge,
                transport,
                path.as_path(),
                action,
            );
        }
    }
    for path in previous.keys() {
        if current.contains_key(path) {
            continue;
        }
        apply_sync_change(
            session_id,
            config,
            bridge,
            transport,
            path.as_path(),
            SyncAction::Delete,
        );
    }
}

fn apply_sync_change(
    session_id: &str,
    config: &ProjectConfig,
    bridge: &EventBridge,
    transport: &dyn SyncTransport,
    path: &Path,
    action: SyncAction,
) {
    let result = resolve_sync_task(session_id, config, path, action.clone()).and_then(|task| {
        transport.apply(&task, &config.sync)?;
        Ok(task)
    });
    match result {
        Ok(task) => {
            let _ = bridge.emit_sync(
                &task.session_id,
                action_text(&task.action),
                &task.protocol,
                "completed",
                &task.remote_path,
                "sync completed",
            );
        }
        Err(error) => {
            let _ = bridge.emit_sync(
                session_id,
                action_text(&action),
                protocol_text(&config.sync.protocol),
                "error",
                &path.display().to_string(),
                &error,
            );
        }
    }
}

fn action_text(action: &SyncAction) -> &'static str {
    match action {
        SyncAction::Create => "create",
        SyncAction::Update => "update",
        SyncAction::Delete => "delete",
    }
}

fn protocol_text(protocol: &SyncProtocol) -> &'static str {
    match protocol {
        SyncProtocol::Sftp => "sftp",
        SyncProtocol::Ftp => "ftp",
        SyncProtocol::Local => "local",
    }
}
