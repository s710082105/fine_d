use serde::Serialize;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const SESSION_EVENT_TOPIC: &str = "session://event";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionEventType {
  Status,
  Stdout,
  Stderr,
  ProcessExit,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEvent {
  pub session_id: String,
  pub event_type: SessionEventType,
  pub message: String,
  pub timestamp: String,
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

  fn emit(&self, session_id: &str, event_type: SessionEventType, message: &str) -> Result<(), String> {
    let event = SessionEvent {
      session_id: session_id.into(),
      event_type,
      message: message.into(),
      timestamp: unix_timestamp()?,
    };
    self.emitter.emit(&event)
  }
}

pub struct TauriSessionEmitter {
  app: AppHandle,
}

impl SessionEventEmitter for TauriSessionEmitter {
  fn emit(&self, event: &SessionEvent) -> Result<(), String> {
    self
      .app
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
