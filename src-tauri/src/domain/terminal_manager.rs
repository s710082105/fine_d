mod cleanup;
mod runtime;
#[cfg(test)]
mod tests;

use super::terminal_event_bridge::TerminalEventBridge;
use cleanup::{cleanup_start_failure, kill_child};
use portable_pty::Child;
use runtime::{
    pty_size, spawn_pty_session, spawn_session_tasks, wait_for_session_removal, SharedMaster,
    SharedWriter,
};
use serde::Serialize;
use std::collections::HashMap;
use std::fmt::Display;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_ROWS: u16 = 24;
const DEFAULT_COLS: u16 = 80;
const PTY_PIXEL_SIZE: u16 = 0;
const EXIT_POLL_INTERVAL_MS: u64 = 25;
const WAIT_ATTEMPTS: u8 = 80;
const OUTPUT_BUFFER_SIZE: usize = 1024;

type SharedChild = Arc<Mutex<Box<dyn Child + Send + Sync>>>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionMetadata {
    pub session_id: String,
    pub pid: u32,
    pub command: String,
    pub args: Vec<String>,
    pub working_dir: String,
    pub started_at: String,
}

#[derive(Clone, Debug)]
pub struct TerminalLaunchConfig {
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub working_dir: PathBuf,
}

#[derive(Clone)]
pub struct TerminalManager {
    sessions: Arc<Mutex<HashMap<String, TerminalSessionState>>>,
    failures: Arc<Mutex<Vec<String>>>,
    bridge: TerminalEventBridge,
}

#[derive(Clone)]
struct TerminalSessionState {
    metadata: TerminalSessionMetadata,
    child: SharedChild,
    master: SharedMaster,
    writer: SharedWriter,
}

impl TerminalManager {
    pub fn new(bridge: TerminalEventBridge) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            failures: Arc::new(Mutex::new(Vec::new())),
            bridge,
        }
    }

    pub fn start_session(
        &self,
        session_id: &str,
        config: &TerminalLaunchConfig,
    ) -> Result<TerminalSessionMetadata, String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|error| poison("terminal manager", error))?;
        if sessions.contains_key(session_id) {
            return Err(format!("terminal session already running: {session_id}"));
        }
        let spawned = spawn_pty_session(session_id, config)?;
        let metadata = spawned.state.metadata.clone();
        self.bridge
            .emit_started(session_id, "terminal session started")
            .map_err(|error| {
                cleanup_start_failure(
                    "failed to emit terminal started event",
                    spawned.state.child.clone(),
                    error,
                )
            })?;
        sessions.insert(
            spawned.state.metadata.session_id.clone(),
            spawned.state.clone(),
        );
        drop(sessions);
        spawn_session_tasks(
            self,
            session_id,
            spawned.state.child,
            spawned.reader,
            self.bridge.clone(),
        );
        Ok(metadata)
    }

    pub fn contains_session(&self, session_id: &str) -> Result<bool, String> {
        Ok(self
            .sessions
            .lock()
            .map_err(|error| poison("terminal manager", error))?
            .contains_key(session_id))
    }

    pub fn close_session(&self, session_id: &str) -> Result<(), String> {
        let child = self.session_for(session_id)?.child;
        kill_child(&child)?;
        wait_for_session_removal(self, session_id)
    }

    pub fn resize_session(&self, session_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        if rows == 0 || cols == 0 {
            return Err("terminal size must be greater than zero".into());
        }
        let master = self.session_for(session_id)?.master;
        let guard = master
            .lock()
            .map_err(|error| poison("terminal pty", error))?;
        guard
            .resize(pty_size(rows, cols))
            .map_err(|error| format!("failed to resize terminal session: {error}"))
    }

    pub fn write_input(&self, session_id: &str, payload: &str) -> Result<(), String> {
        let writer = self.session_for(session_id)?.writer;
        let mut guard = writer
            .lock()
            .map_err(|error| poison("terminal writer", error))?;
        use std::io::Write;
        guard
            .write_all(payload.as_bytes())
            .map_err(|error| format!("failed to write terminal input: {error}"))?;
        guard
            .flush()
            .map_err(|error| format!("failed to flush terminal input: {error}"))
    }

    pub fn take_failures(&self) -> Result<Vec<String>, String> {
        Ok(std::mem::take(
            &mut *self
                .failures
                .lock()
                .map_err(|error| poison("terminal failure", error))?,
        ))
    }

    fn remove_session(&self, session_id: &str) -> Result<(), String> {
        self.sessions
            .lock()
            .map_err(|error| poison("terminal manager", error))?
            .remove(session_id);
        Ok(())
    }

    fn session_for(&self, session_id: &str) -> Result<TerminalSessionState, String> {
        self.sessions
            .lock()
            .map_err(|error| poison("terminal manager", error))?
            .get(session_id)
            .cloned()
            .ok_or_else(|| format!("terminal session not found: {session_id}"))
    }

    fn record_failure(&self, message: String) -> Result<(), String> {
        self.failures
            .lock()
            .map_err(|error| poison("terminal failure", error))?
            .push(message);
        Ok(())
    }
}

fn unix_timestamp() -> Result<String, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to get unix timestamp: {error}"))?;
    Ok(now.as_secs().to_string())
}

fn poison(label: &str, error: impl Display) -> String {
    format!("failed to acquire {label} lock: {error}")
}
