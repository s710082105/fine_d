use super::{poison, SharedChild, TerminalManager, EXIT_POLL_INTERVAL_MS, WAIT_ATTEMPTS};
use std::thread;
use std::time::Duration;

pub(super) fn cleanup_start_failure(label: &str, child: SharedChild, error: String) -> String {
    let cleanup = kill_child(&child).and_then(|_| wait_for_child_exit(&child));
    if let Err(cleanup_error) = cleanup {
        return format!("{label}: {error}; cleanup failed: {cleanup_error}");
    }
    format!("{label}: {error}")
}

pub(super) fn cleanup_spawn_failure(label: &str, child: SharedChild, error: String) -> String {
    let cleanup = kill_child(&child).and_then(|_| wait_for_child_exit(&child));
    if let Err(cleanup_error) = cleanup {
        return format!("{label}: {error}; cleanup failed: {cleanup_error}");
    }
    format!("{label}: {error}")
}

pub(super) fn kill_child(child: &SharedChild) -> Result<(), String> {
    child
        .lock()
        .map_err(|error| poison("terminal child", error))?
        .kill()
        .map_err(|error| format!("failed to close terminal process: {error}"))
}

pub(super) fn poll_child(child: &SharedChild) -> Result<Option<String>, String> {
    child
        .lock()
        .map_err(|error| poison("terminal child", error))?
        .try_wait()
        .map_err(|error| format!("failed to poll terminal process exit status: {error}"))
        .map(|status| status.map(|value| format!("terminal process exited: {value}")))
}

pub(super) fn record_remove_failure(manager: &TerminalManager, session_id: &str) {
    if let Err(error) = manager.remove_session(session_id) {
        must_record_failure(manager, error);
    }
}

pub(super) fn must_record_failure(manager: &TerminalManager, message: String) {
    if let Err(error) = manager.record_failure(message.clone()) {
        panic!("failed to record terminal failure: {error}; original failure: {message}");
    }
}

fn wait_for_child_exit(child: &SharedChild) -> Result<(), String> {
    for _ in 0..WAIT_ATTEMPTS {
        if poll_child(child)?.is_some() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(EXIT_POLL_INTERVAL_MS));
    }
    Err("timed out waiting for terminal process exit".into())
}
