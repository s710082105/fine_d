use finereport_tauri_shell_lib::domain::codex_process_manager::{
    CodexProcessManager, ProcessLaunchConfig,
};
use finereport_tauri_shell_lib::domain::event_bridge::{EventBridge, NullEventEmitter};
use finereport_tauri_shell_lib::test_support::{
    python_command, python_exit_script, python_long_running_script,
};
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn wait_for_process_cleanup(manager: &CodexProcessManager, session_id: &str) {
    for _ in 0..40 {
        if !manager
            .contains_session(session_id)
            .expect("inspect process manager state")
        {
            return;
        }
        thread::sleep(Duration::from_millis(25));
    }
    panic!("timed out waiting for process cleanup");
}

#[test]
fn start_process_runs_exit_hook_after_child_exit() {
    let hook_calls = Arc::new(AtomicUsize::new(0));
    let hook_session_id = Arc::new(Mutex::new(String::new()));
    let hook_calls_clone = hook_calls.clone();
    let hook_session_id_clone = hook_session_id.clone();
    let manager = CodexProcessManager::default();
    let bridge = EventBridge::new(Arc::new(NullEventEmitter));
    let exit_script = python_exit_script(0);
    let (command, args) = python_command(exit_script.as_str());

    manager
        .start_process(
            "session-1",
            &ProcessLaunchConfig {
                command,
                args,
                env: HashMap::new(),
                working_dir: std::env::temp_dir(),
                exit_hook: Some(Arc::new(move |session_id| {
                    hook_calls_clone.fetch_add(1, Ordering::Relaxed);
                    let mut lock = hook_session_id_clone.lock().expect("lock hook session id");
                    *lock = session_id.into();
                })),
                stdout_hook: None,
            },
            &bridge,
        )
        .expect("start short-lived process");

    wait_for_process_cleanup(&manager, "session-1");
    assert_eq!(hook_calls.load(Ordering::Relaxed), 1);
    assert_eq!(
        hook_session_id
            .lock()
            .expect("lock hook session id")
            .as_str(),
        "session-1"
    );
}

#[test]
fn interrupt_process_sends_signal_to_running_session() {
    let manager = CodexProcessManager::default();
    let bridge = EventBridge::new(Arc::new(NullEventEmitter));
    let long_running_script = python_long_running_script();
    let (command, args) = python_command(long_running_script.as_str());

    manager
        .start_process(
            "session-2",
            &ProcessLaunchConfig {
                command,
                args,
                env: HashMap::new(),
                working_dir: std::env::temp_dir(),
                exit_hook: None,
                stdout_hook: None,
            },
            &bridge,
        )
        .expect("start long-running process");

    manager
        .interrupt_process("session-2")
        .expect("interrupt running process");
    wait_for_process_cleanup(&manager, "session-2");
}
