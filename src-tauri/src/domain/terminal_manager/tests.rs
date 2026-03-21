use super::{cleanup::cleanup_spawn_failure, TerminalLaunchConfig, TerminalManager};
use crate::domain::terminal_event_bridge::{
    TerminalEvent, TerminalEventBridge, TerminalEventEmitter, TerminalEventType,
};
use crate::test_support::{python_command, python_long_running_script};
use portable_pty::{Child, ChildKiller, ExitStatus};
use std::collections::HashMap;
use std::io;
use std::path::PathBuf;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

const WAIT_ATTEMPTS: u8 = 80;
const WAIT_INTERVAL_MS: u64 = 25;
#[derive(Clone)]
struct BlockingStartedEmitter {
    sender: mpsc::Sender<()>,
    receiver: Arc<Mutex<mpsc::Receiver<()>>>,
}

#[derive(Clone, Debug)]
struct FakeChild {
    state: Arc<Mutex<FakeChildState>>,
}

#[derive(Debug, Default)]
struct FakeChildState {
    killed: bool,
}

impl FakeChild {
    fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(FakeChildState::default())),
        }
    }
}

#[derive(Clone, Debug)]
struct FakeChildKiller {
    state: Arc<Mutex<FakeChildState>>,
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

impl ChildKiller for FakeChild {
    fn kill(&mut self) -> io::Result<()> {
        self.state.lock().expect("lock fake child state").killed = true;
        Ok(())
    }

    fn clone_killer(&self) -> Box<dyn ChildKiller + Send + Sync> {
        Box::new(FakeChildKiller {
            state: self.state.clone(),
        })
    }
}

impl ChildKiller for FakeChildKiller {
    fn kill(&mut self) -> io::Result<()> {
        self.state.lock().expect("lock fake killer state").killed = true;
        Ok(())
    }

    fn clone_killer(&self) -> Box<dyn ChildKiller + Send + Sync> {
        Box::new(self.clone())
    }
}

impl Child for FakeChild {
    fn try_wait(&mut self) -> io::Result<Option<ExitStatus>> {
        let killed = self.state.lock().expect("lock fake child state").killed;
        Ok(killed.then(|| ExitStatus::with_exit_code(1)))
    }

    fn wait(&mut self) -> io::Result<ExitStatus> {
        Ok(ExitStatus::with_exit_code(1))
    }

    fn process_id(&self) -> Option<u32> {
        Some(42)
    }

    #[cfg(windows)]
    fn as_raw_handle(&self) -> Option<std::os::windows::io::RawHandle> {
        None
    }
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
        first_manager.start_session(
            "shared",
            &build_config(python_long_running_script().as_str()),
        )
    });
    started_rx
        .recv_timeout(Duration::from_secs(1))
        .expect("wait for first started emit");

    let second_manager = manager.clone();
    let second = thread::spawn(move || {
        second_manager.start_session(
            "shared",
            &build_config(python_long_running_script().as_str()),
        )
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
    let child = Arc::new(Mutex::new(Box::new(FakeChild::new()) as Box<dyn Child + Send + Sync>));
    let child_probe = child.clone();
    let error = cleanup_spawn_failure("metadata failure", child, "clock failed".into());

    assert!(error.contains("clock failed"));
    wait_until("spawn cleanup", || {
        child_probe
            .lock()
            .expect("lock child probe")
            .try_wait()
            .expect("poll child status")
            .is_some()
    });
}
