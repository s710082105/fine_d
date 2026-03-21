use serde::Serialize;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

const TERMINAL_EVENT_TOPIC: &str = "terminal://event";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TerminalEventType {
    Started,
    Output,
    Exited,
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalEvent {
    pub session_id: String,
    pub event_type: TerminalEventType,
    pub message: String,
    pub timestamp: String,
}

pub trait TerminalEventEmitter: Send + Sync {
    fn emit(&self, event: &TerminalEvent) -> Result<(), String>;
}

#[derive(Default)]
pub struct TerminalOutputDecoder {
    pending_bytes: Vec<u8>,
}

#[derive(Clone)]
pub struct TerminalEventBridge {
    emitter: Arc<dyn TerminalEventEmitter>,
}

impl TerminalEventBridge {
    pub fn new(emitter: Arc<dyn TerminalEventEmitter>) -> Self {
        Self { emitter }
    }

    pub fn from_app(app: AppHandle) -> Self {
        Self::new(Arc::new(TauriTerminalEmitter { app }))
    }

    pub fn emit_started(&self, session_id: &str, message: &str) -> Result<(), String> {
        self.emit(session_id, TerminalEventType::Started, message.into())
    }

    pub fn emit_output_bytes(
        &self,
        session_id: &str,
        bytes: &[u8],
        decoder: &mut TerminalOutputDecoder,
    ) -> Result<(), String> {
        if let Some(message) = decoder.push(bytes)? {
            return self.emit(session_id, TerminalEventType::Output, message);
        }
        Ok(())
    }

    pub fn emit_exited(&self, session_id: &str, message: &str) -> Result<(), String> {
        self.emit(session_id, TerminalEventType::Exited, message.into())
    }

    pub fn emit_error(&self, session_id: &str, message: &str) -> Result<(), String> {
        self.emit(session_id, TerminalEventType::Error, message.into())
    }

    fn emit(
        &self,
        session_id: &str,
        event_type: TerminalEventType,
        message: String,
    ) -> Result<(), String> {
        self.emitter.emit(&TerminalEvent {
            session_id: session_id.into(),
            event_type,
            message,
            timestamp: unix_timestamp()?,
        })
    }
}

impl TerminalOutputDecoder {
    pub fn finish(self) -> Result<(), String> {
        if self.pending_bytes.is_empty() {
            return Ok(());
        }
        Err("terminal output ended with incomplete utf-8 sequence".into())
    }

    fn push(&mut self, bytes: &[u8]) -> Result<Option<String>, String> {
        self.pending_bytes.extend_from_slice(bytes);
        match std::str::from_utf8(&self.pending_bytes) {
            Ok(text) => {
                let message = text.to_string();
                self.pending_bytes.clear();
                Ok((!message.is_empty()).then_some(message))
            }
            Err(error) if error.error_len().is_none() => {
                let valid_up_to = error.valid_up_to();
                if valid_up_to == 0 {
                    return Ok(None);
                }
                let pending = self.pending_bytes.split_off(valid_up_to);
                let message =
                    String::from_utf8(self.pending_bytes.clone()).map_err(|decode_error| {
                        format!("failed to decode terminal output: {decode_error}")
                    })?;
                self.pending_bytes = pending;
                Ok(Some(message))
            }
            Err(error) => Err(format!("invalid utf-8 in terminal output: {error}")),
        }
    }
}

pub struct TauriTerminalEmitter {
    app: AppHandle,
}

impl TerminalEventEmitter for TauriTerminalEmitter {
    fn emit(&self, event: &TerminalEvent) -> Result<(), String> {
        self.app
            .emit(TERMINAL_EVENT_TOPIC, event)
            .map_err(|error| format!("failed to emit terminal event: {error}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decoder_reassembles_split_multibyte_utf8() {
        let mut decoder = TerminalOutputDecoder::default();
        // "中" = 0xE4 0xB8 0xAD（3字节），分两次写入
        let data = "中\n".as_bytes();
        // 前2字节：不完整序列，应返回 None
        assert_eq!(decoder.push(&data[..2]).unwrap(), None);
        // 后2字节：拼接后产出完整字符
        assert_eq!(decoder.push(&data[2..]).unwrap(), Some("中\n".into()));
        decoder.finish().unwrap();
    }

    #[test]
    fn decoder_emits_valid_prefix_and_holds_incomplete_tail() {
        let mut decoder = TerminalOutputDecoder::default();
        // "ab" + "中"的前2字节
        let mut chunk = b"ab".to_vec();
        chunk.extend_from_slice(&"中".as_bytes()[..2]);
        assert_eq!(decoder.push(&chunk).unwrap(), Some("ab".into()));
        // 补齐"中"的最后1字节
        assert_eq!(
            decoder.push(&"中".as_bytes()[2..]).unwrap(),
            Some("中".into())
        );
        decoder.finish().unwrap();
    }

    #[test]
    fn decoder_finish_rejects_incomplete_sequence() {
        let mut decoder = TerminalOutputDecoder::default();
        let _ = decoder.push(&"中".as_bytes()[..2]).unwrap();
        assert!(decoder.finish().is_err());
    }

    #[test]
    fn decoder_handles_pure_ascii() {
        let mut decoder = TerminalOutputDecoder::default();
        assert_eq!(
            decoder.push(b"hello").unwrap(),
            Some("hello".into())
        );
        decoder.finish().unwrap();
    }
}

fn unix_timestamp() -> Result<String, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to get unix timestamp: {error}"))?;
    Ok(now.as_secs().to_string())
}
