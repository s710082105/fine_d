use super::{cleanup::cleanup_spawn_failure, TerminalLaunchConfig, TerminalManager};
use crate::domain::terminal_event_bridge::{
    TerminalEvent, TerminalEventBridge, TerminalEventEmitter, TerminalEventType,
};
use portable_pty::{native_pty_system, CommandBuilder};
use std::path::PathBuf;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const WAIT_ATTEMPTS: u8 = 80;
const WAIT_INTERVAL_MS: u64 = 25;
const LONG_RUNNING_SCRIPT: &str = "trap 'exit 0' INT TERM; while true; do sleep 1; done";

#[derive(Clone)]
struct BlockingStartedEmitter {
    sender: mpsc::Sender<()>,
    receiver: Arc<Mutex<mpsc::Receiver<()>>>,
}

impl BlockingStartedEmitter {
    fn new() -> (Self, mpsc::Receiver<()>, mpsc::Sender<()>) {
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        (
            Self {
                sender: entered_tx,
                receiver: Arc::new(Mutex::new(release_rx)),
            },
            entered_rx,
            release_tx,
        )
    }
}

impl TerminalEventEmitter for BlockingStartedEmitter {
    fn emit(&self, event: &TerminalEvent) -> Result<(), String> {
        if event.event_type == TerminalEventType::Started {
            self.sender
                .send(())
                .map_err(|error| format!("failed to signal started event: {error}"))?;
            self.receiver
                .lock()
                .expect("lock release receiver")
                .recv()
                .map_err(|error| format!("failed to wait for release signal: {error}"))?;
        }
        Ok(())
    }
}

fn build_config(script: &str) -> TerminalLaunchConfig {
    TerminalLaunchConfig {
        command: "sh".into(),
        args: vec!["-c".into(), script.into()],
        working_dir: PathBuf::from(std::env::temp_dir()),
    }
}

fn unique_marker_path() -> PathBuf {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time after epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("terminal-manager-runtime-{now}.txt"))
}

fn build_pid_script(path: &str) -> String {
    format!("echo $$ > {path}; while true; do sleep 1; done")
}

fn wait_until(label: &str, condition: impl Fn() -> bool) {
    for _ in 0..WAIT_ATTEMPTS {
        if condition() {
            return;
        }
        thread::sleep(Duration::from_millis(WAIT_INTERVAL_MS));
    }
    panic!("timed out waiting for {label}");
}

#[test]
fn terminal_manager_rejects_duplicate_session_id_while_first_start_is_in_progress() {
    let (emitter, started_rx, release_tx) = BlockingStartedEmitter::new();
    let manager = TerminalManager::new(TerminalEventBridge::new(Arc::new(emitter)));
    let first_manager = manager.clone();

    let first = thread::spawn(move || {
        first_manager.start_session("shared", &build_config(LONG_RUNNING_SCRIPT))
    });
    started_rx
        .recv_timeout(Duration::from_secs(1))
        .expect("wait for first started emit");

    let second_manager = manager.clone();
    let second = thread::spawn(move || {
        second_manager.start_session("shared", &build_config(LONG_RUNNING_SCRIPT))
    });

    release_tx.send(()).expect("release started emit");
    let first_result = first.join().expect("join first start thread");
    let second_result = second.join().expect("join second start thread");

    let metadata = first_result.expect("first start succeeds");
    let error = second_result.expect_err("second start should be rejected");

    assert_eq!(metadata.session_id, "shared");
    assert!(error.contains("terminal session already running"));

    manager
        .close_session("shared")
        .expect("close started session");
}

#[test]
fn terminal_manager_spawn_cleanup_terminates_process_when_metadata_creation_fails() {
    let pid_path = unique_marker_path();
    let script = build_pid_script(pid_path.to_string_lossy().as_ref());
    let pair = native_pty_system()
        .openpty(super::runtime::pty_size(24, 80))
        .expect("open pty");
    let child = pair
        .slave
        .spawn_command({
            let mut builder = CommandBuilder::new("sh");
            builder.arg("-c");
            builder.arg(script.as_str());
            builder
        })
        .expect("spawn child");
    let child = Arc::new(Mutex::new(child));

    wait_until("pid file creation", || pid_path.exists());
    let pid = std::fs::read_to_string(&pid_path).expect("read pid file");
    let child_probe = child.clone();
    let error = cleanup_spawn_failure("metadata failure", child, "clock failed".into());

    assert!(error.contains("clock failed"));
    assert!(!pid.trim().is_empty());
    wait_until("spawn cleanup", || {
        child_probe
            .lock()
            .expect("lock child probe")
            .try_wait()
            .expect("poll child status")
            .is_some()
    });
}
