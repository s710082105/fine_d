use finereport_tauri_shell_lib::domain::terminal_event_bridge::{
    TerminalEvent, TerminalEventBridge, TerminalEventEmitter, TerminalEventType,
};
use finereport_tauri_shell_lib::domain::terminal_manager::{TerminalLaunchConfig, TerminalManager};
use finereport_tauri_shell_lib::test_support::{
    python_command, python_exit_script, python_input_echo_script, python_long_running_script,
    python_pid_script, python_print_line_script, python_print_no_newline_script,
    python_split_utf8_script,
};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const WAIT_ATTEMPTS: u8 = 80;
const WAIT_INTERVAL_MS: u64 = 25;
const NO_NEWLINE_ATTEMPTS: u8 = 12;

#[derive(Clone)]
struct TestEmitter {
    events: Arc<Mutex<Vec<TerminalEvent>>>,
    fail_on: Arc<Mutex<Vec<TerminalEventType>>>,
}

impl TestEmitter {
    fn new(fail_on: Vec<TerminalEventType>) -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            fail_on: Arc::new(Mutex::new(fail_on)),
        }
    }
}

impl TerminalEventEmitter for TestEmitter {
    fn emit(&self, event: &TerminalEvent) -> Result<(), String> {
        if self
            .fail_on
            .lock()
            .expect("lock fail_on")
            .contains(&event.event_type)
        {
            return Err(format!("forced emitter failure: {:?}", event.event_type));
        }
        self.events.lock().expect("lock events").push(event.clone());
        Ok(())
    }
}

fn wait_until(label: &str, attempts: u8, condition: impl Fn() -> bool) {
    for _ in 0..attempts {
        if condition() {
            return;
        }
        thread::sleep(Duration::from_millis(WAIT_INTERVAL_MS));
    }
    panic!("timed out waiting for {label}");
}

fn build_config(script: &str) -> TerminalLaunchConfig {
    let (command, args) = python_command(script);
    TerminalLaunchConfig {
        command,
        args,
        env: HashMap::new(),
        working_dir: PathBuf::from(std::env::temp_dir()),
    }
}

fn build_pid_script(path: &str) -> String {
    python_pid_script(PathBuf::from(path).as_path())
}

fn unique_marker_path() -> PathBuf {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("terminal-manager-cleanup-{now}.txt"))
}

fn process_is_running(pid: &str) -> bool {
    if cfg!(target_os = "windows") {
        return Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}")])
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).contains(pid))
            .unwrap_or(false);
    }
    Command::new("ps")
        .args(["-p", pid])
        .status()
        .expect("run ps for pid")
        .success()
}

fn has_event(emitter: &TestEmitter, event_type: TerminalEventType, fragment: &str) -> bool {
    emitter
        .events
        .lock()
        .expect("lock events")
        .iter()
        .any(|event| event.event_type == event_type && event.message.contains(fragment))
}

fn has_failure(manager: &TerminalManager, fragment: &str) -> bool {
    manager
        .take_failures()
        .expect("read terminal failures")
        .iter()
        .any(|message| message.contains(fragment))
}

#[test]
fn terminal_manager_lifecycle_starts_process_and_streams_output() {
    let emitter = TestEmitter::new(Vec::new());
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter.clone())));

    manager
        .start_session(
            "terminal-session-1",
            &build_config(python_print_line_script("terminal-ready").as_str()),
        )
        .expect("start terminal session");

    wait_until("terminal output", WAIT_ATTEMPTS, || {
        has_event(&emitter, TerminalEventType::Output, "terminal-ready")
    });
    wait_until("terminal cleanup", WAIT_ATTEMPTS, || {
        !manager
            .contains_session("terminal-session-1")
            .expect("inspect terminal session")
    });
}

#[test]
fn terminal_manager_lifecycle_cleans_session_after_process_exit() {
    let emitter = TestEmitter::new(Vec::new());
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter)));

    manager
        .start_session(
            "terminal-session-2",
            &build_config(python_exit_script(0).as_str()),
        )
        .expect("start short-lived terminal session");

    wait_until("terminal cleanup", WAIT_ATTEMPTS, || {
        !manager
            .contains_session("terminal-session-2")
            .expect("inspect terminal session")
    });
}

#[test]
fn terminal_manager_lifecycle_cleans_up_when_emit_started_fails() {
    let pid_path = unique_marker_path();
    let script = build_pid_script(pid_path.to_string_lossy().as_ref());
    let emitter = TestEmitter::new(vec![TerminalEventType::Started]);
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter)));

    let error = manager
        .start_session("terminal-session-3", &build_config(script.as_str()))
        .expect_err("fail when started event emission fails");
    assert!(error.contains("forced emitter failure"));

    wait_until("failed start cleanup", WAIT_ATTEMPTS, || {
        !manager
            .contains_session("terminal-session-3")
            .expect("inspect terminal session")
    });
    if pid_path.exists() {
        let pid = fs::read_to_string(&pid_path).expect("read pid file");
        wait_until("killed process", WAIT_ATTEMPTS, || {
            !process_is_running(pid.trim())
        });
    }
}

#[test]
fn terminal_manager_lifecycle_close_session_terminates_running_process() {
    let emitter = TestEmitter::new(Vec::new());
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter.clone())));

    manager
        .start_session(
            "terminal-session-4",
            &build_config(python_long_running_script().as_str()),
        )
        .expect("start long-running session");
    manager
        .close_session("terminal-session-4")
        .expect("close running session");

    wait_until("close_session cleanup", WAIT_ATTEMPTS, || {
        !manager
            .contains_session("terminal-session-4")
            .expect("inspect terminal session")
    });
    wait_until("close_session exited event", WAIT_ATTEMPTS, || {
        has_event(
            &emitter,
            TerminalEventType::Exited,
            "terminal process exited",
        )
    });
}

#[test]
fn terminal_manager_lifecycle_resize_session_validates_bounds() {
    let emitter = TestEmitter::new(Vec::new());
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter)));

    manager
        .start_session(
            "terminal-session-5",
            &build_config(python_long_running_script().as_str()),
        )
        .expect("start long-running session");

    assert_eq!(
        manager
            .resize_session("terminal-session-5", 0, 80)
            .expect_err("reject zero rows"),
        "terminal size must be greater than zero"
    );
    assert_eq!(
        manager
            .resize_session("terminal-session-5", 24, 0)
            .expect_err("reject zero cols"),
        "terminal size must be greater than zero"
    );
    manager
        .resize_session("terminal-session-5", 30, 120)
        .expect("resize running session");
    manager
        .close_session("terminal-session-5")
        .expect("close resized session");
}

#[test]
fn terminal_manager_lifecycle_streams_output_without_newline_before_exit() {
    let emitter = TestEmitter::new(Vec::new());
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter.clone())));

    manager
        .start_session(
            "terminal-session-6",
            &build_config(python_print_no_newline_script("chunk-without-newline").as_str()),
        )
        .expect("start session without newline output");

    wait_until("non-newline output", NO_NEWLINE_ATTEMPTS, || {
        has_event(&emitter, TerminalEventType::Output, "chunk-without-newline")
    });
    manager
        .close_session("terminal-session-6")
        .expect("close non-newline session");
}

#[test]
fn terminal_manager_lifecycle_streams_multibyte_utf8_across_read_boundaries() {
    let emitter = TestEmitter::new(Vec::new());
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter.clone())));

    manager
        .start_session(
            "terminal-session-7",
            &build_config(python_split_utf8_script("中\n").as_str()),
        )
        .expect("start session with split utf8 output");

    wait_until("split utf8 output", WAIT_ATTEMPTS, || {
        has_event(&emitter, TerminalEventType::Output, "中")
    });
    wait_until("split utf8 cleanup", WAIT_ATTEMPTS, || {
        !manager
            .contains_session("terminal-session-7")
            .expect("inspect split utf8 session")
    });
}

#[test]
fn terminal_manager_lifecycle_take_failures_observes_background_failure() {
    let emitter = TestEmitter::new(vec![TerminalEventType::Output, TerminalEventType::Error]);
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter)));

    manager
        .start_session(
            "terminal-session-8",
            &build_config(python_print_no_newline_script("boom-output").as_str()),
        )
        .expect("start session with failing emitter");

    wait_until("background failure capture", WAIT_ATTEMPTS, || {
        has_failure(&manager, "failed to emit error event")
    });
}

#[test]
fn terminal_manager_lifecycle_write_input_forwards_payload_to_process() {
    let emitter = TestEmitter::new(Vec::new());
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter.clone())));

    manager
        .start_session(
            "terminal-session-9",
            &build_config(python_input_echo_script().as_str()),
        )
        .expect("start terminal session that reads input");
    wait_until("session readiness output", WAIT_ATTEMPTS, || {
        has_event(&emitter, TerminalEventType::Output, "ready")
    });
    manager
        .write_input("terminal-session-9", "hello-terminal\n")
        .expect("write terminal input");
    wait_until("input echo output", WAIT_ATTEMPTS, || {
        has_event(&emitter, TerminalEventType::Output, "input:hello-terminal")
    });
    manager
        .close_session("terminal-session-9")
        .expect("close terminal session after input test");
}
