use serde::Serialize;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const SESSION_EVENT_TOPIC: &str = "session://event";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionEventType {
    Status,
    Stdout,
    Stderr,
    ProcessExit,
    Sync,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEvent {
    pub session_id: String,
    pub event_type: SessionEventType,
    pub message: String,
    pub timestamp: String,
    pub codex_session_id: Option<String>,
    pub tool_name: Option<String>,
    pub tool_status: Option<String>,
    pub tool_summary: Option<String>,
    pub sync_action: Option<String>,
    pub sync_protocol: Option<String>,
    pub sync_status: Option<String>,
    pub sync_path: Option<String>,
}

pub trait SessionEventEmitter: Send + Sync {
    fn emit(&self, event: &SessionEvent) -> Result<(), String>;
}

#[derive(Clone)]
pub struct EventBridge {
    emitter: Arc<dyn SessionEventEmitter>,
}

impl EventBridge {
    pub fn new(emitter: Arc<dyn SessionEventEmitter>) -> Self {
        Self { emitter }
    }

    pub fn from_app(app: AppHandle) -> Self {
        Self::new(Arc::new(TauriSessionEmitter { app }))
    }

    pub fn emit_status(&self, session_id: &str, message: &str) -> Result<(), String> {
        self.emit(session_id, SessionEventType::Status, message)
    }

    pub fn emit_stdout(&self, session_id: &str, message: &str) -> Result<(), String> {
        self.emit(session_id, SessionEventType::Stdout, message)
    }

    pub fn emit_stderr(&self, session_id: &str, message: &str) -> Result<(), String> {
        self.emit(session_id, SessionEventType::Stderr, message)
    }

    pub fn emit_process_exit(&self, session_id: &str, message: &str) -> Result<(), String> {
        self.emit(session_id, SessionEventType::ProcessExit, message)
    }

    pub fn emit_codex_session_ready(
        &self,
        session_id: &str,
        codex_session_id: &str,
    ) -> Result<(), String> {
        self.emit_event(SessionEvent {
            session_id: session_id.into(),
            event_type: SessionEventType::Status,
            message: "codex session ready".into(),
            timestamp: unix_timestamp()?,
            codex_session_id: Some(codex_session_id.into()),
            tool_name: None,
            tool_status: None,
            tool_summary: None,
            sync_action: None,
            sync_protocol: None,
            sync_status: None,
            sync_path: None,
        })
    }

    pub fn emit_sync(
        &self,
        session_id: &str,
        action: &str,
        protocol: &str,
        status: &str,
        path: &str,
        message: &str,
    ) -> Result<(), String> {
        self.emit_event(SessionEvent {
            session_id: session_id.into(),
            event_type: SessionEventType::Sync,
            message: message.into(),
            timestamp: unix_timestamp()?,
            codex_session_id: None,
            tool_name: None,
            tool_status: None,
            tool_summary: None,
            sync_action: Some(action.into()),
            sync_protocol: Some(protocol.into()),
            sync_status: Some(status.into()),
            sync_path: Some(path.into()),
        })
    }

    fn emit(
        &self,
        session_id: &str,
        event_type: SessionEventType,
        message: &str,
    ) -> Result<(), String> {
        self.emit_event(SessionEvent {
            session_id: session_id.into(),
            event_type,
            message: message.into(),
            timestamp: unix_timestamp()?,
            codex_session_id: None,
            tool_name: None,
            tool_status: None,
            tool_summary: None,
            sync_action: None,
            sync_protocol: None,
            sync_status: None,
            sync_path: None,
        })
    }

    fn emit_event(&self, event: SessionEvent) -> Result<(), String> {
        self.emitter.emit(&event)
    }
}

pub struct TauriSessionEmitter {
    app: AppHandle,
}

impl SessionEventEmitter for TauriSessionEmitter {
    fn emit(&self, event: &SessionEvent) -> Result<(), String> {
        self.app
            .emit(SESSION_EVENT_TOPIC, event)
            .map_err(|error| format!("failed to emit session event: {error}"))
    }
}

pub struct NullEventEmitter;

impl SessionEventEmitter for NullEventEmitter {
    fn emit(&self, _: &SessionEvent) -> Result<(), String> {
        Ok(())
    }
}

fn unix_timestamp() -> Result<String, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to get unix timestamp: {error}"))?;
    Ok(now.as_secs().to_string())
}
