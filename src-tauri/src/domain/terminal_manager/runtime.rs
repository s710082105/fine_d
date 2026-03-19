use super::{
    cleanup::{
        cleanup_spawn_failure, kill_child, must_record_failure, poll_child, record_remove_failure,
    },
    poison, unix_timestamp, SharedChild, TerminalLaunchConfig, TerminalManager,
    TerminalSessionMetadata, TerminalSessionState, DEFAULT_COLS, DEFAULT_ROWS,
    EXIT_POLL_INTERVAL_MS, OUTPUT_BUFFER_SIZE, PTY_PIXEL_SIZE, WAIT_ATTEMPTS,
};
use crate::domain::terminal_event_bridge::{TerminalEventBridge, TerminalOutputDecoder};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub(super) type SharedMaster = Arc<Mutex<Box<dyn MasterPty + Send>>>;
pub(super) type SharedWriter = Arc<Mutex<Box<dyn Write + Send>>>;

pub(super) struct SpawnedSession {
    pub reader: Box<dyn Read + Send>,
    pub state: TerminalSessionState,
}

struct TaskContext {
    session_id: String,
    child: SharedChild,
    manager: TerminalManager,
}

struct OutputContext {
    task: TaskContext,
    bridge: TerminalEventBridge,
    reader: Box<dyn Read + Send>,
}

pub(super) fn spawn_pty_session(
    session_id: &str,
    config: &TerminalLaunchConfig,
) -> Result<SpawnedSession, String> {
    spawn_pty_session_with_clock(session_id, config, unix_timestamp)
}

pub(super) fn spawn_pty_session_with_clock(
    session_id: &str,
    config: &TerminalLaunchConfig,
    now: fn() -> Result<String, String>,
) -> Result<SpawnedSession, String> {
    let pair = native_pty_system()
        .openpty(pty_size(DEFAULT_ROWS, DEFAULT_COLS))
        .map_err(|error| format!("failed to open terminal pty: {error}"))?;
    let child = pair
        .slave
        .spawn_command(build_command_builder(config))
        .map_err(|error| format!("failed to spawn terminal process: {error}"))?;
    let child = Arc::new(Mutex::new(child));
    let reader = pair.master.try_clone_reader().map_err(|error| {
        cleanup_spawn_failure(
            "failed to clone terminal output reader",
            child.clone(),
            error.to_string(),
        )
    })?;
    let writer = pair.master.take_writer().map_err(|error| {
        cleanup_spawn_failure(
            "failed to clone terminal input writer",
            child.clone(),
            error.to_string(),
        )
    })?;
    let metadata =
        build_session_metadata(session_id, config, child.clone(), now).map_err(|error| {
            cleanup_spawn_failure(
                "failed to build terminal session metadata",
                child.clone(),
                error,
            )
        })?;
    Ok(SpawnedSession {
        reader,
        state: TerminalSessionState {
            metadata,
            child,
            master: Arc::new(Mutex::new(pair.master)),
            writer: Arc::new(Mutex::new(writer)),
        },
    })
}

fn spawn_output_forwarder(context: OutputContext) {
    thread::spawn(move || stream_output(context));
}

pub(super) fn spawn_session_tasks(
    manager: &TerminalManager,
    session_id: &str,
    child: SharedChild,
    reader: Box<dyn Read + Send>,
    bridge: TerminalEventBridge,
) {
    spawn_output_forwarder(OutputContext {
        task: TaskContext {
            session_id: session_id.into(),
            child: child.clone(),
            manager: manager.clone(),
        },
        bridge,
        reader,
    });
    spawn_exit_watcher(manager, session_id, child);
}

pub(super) fn spawn_exit_watcher(manager: &TerminalManager, session_id: &str, child: SharedChild) {
    let task = TaskContext {
        session_id: session_id.into(),
        child,
        manager: manager.clone(),
    };
    thread::spawn(move || watch_exit(task));
}

pub(super) fn wait_for_session_removal(
    manager: &TerminalManager,
    session_id: &str,
) -> Result<(), String> {
    for _ in 0..WAIT_ATTEMPTS {
        if !manager.contains_session(session_id)? {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(EXIT_POLL_INTERVAL_MS));
    }
    Err(format!(
        "timed out waiting for terminal session cleanup: {session_id}"
    ))
}

fn build_session_metadata(
    session_id: &str,
    config: &TerminalLaunchConfig,
    child: SharedChild,
    now: fn() -> Result<String, String>,
) -> Result<TerminalSessionMetadata, String> {
    Ok(TerminalSessionMetadata {
        session_id: session_id.into(),
        pid: child
            .lock()
            .map_err(|error| poison("terminal child", error))?
            .process_id()
            .ok_or_else(|| "terminal process pid unavailable".to_string())?,
        command: config.command.clone(),
        args: config.args.clone(),
        working_dir: config.working_dir.display().to_string(),
        started_at: now()?,
    })
}

fn build_command_builder(config: &TerminalLaunchConfig) -> CommandBuilder {
    let mut builder = CommandBuilder::new(config.command.as_str());
    builder.cwd(config.working_dir.clone());
    for arg in &config.args {
        builder.arg(arg.as_str());
    }
    builder
}

fn stream_output(mut context: OutputContext) {
    let mut decoder = TerminalOutputDecoder::default();
    let mut buffer = [0_u8; OUTPUT_BUFFER_SIZE];
    loop {
        match context.reader.read(&mut buffer) {
            Ok(0) => {
                if let Err(error) = decoder.finish() {
                    report_task_failure(&context.task, &context.bridge, error);
                }
                return;
            }
            Ok(size) => {
                if let Err(error) = context.bridge.emit_output_bytes(
                    context.task.session_id.as_str(),
                    &buffer[..size],
                    &mut decoder,
                ) {
                    report_task_failure(
                        &context.task,
                        &context.bridge,
                        format!("failed to emit terminal output event: {error}"),
                    );
                    return;
                }
            }
            Err(error) => {
                report_task_failure(
                    &context.task,
                    &context.bridge,
                    format!("failed to read terminal output: {error}"),
                );
                return;
            }
        }
    }
}

fn watch_exit(task: TaskContext) {
    loop {
        match poll_child(&task.child) {
            Ok(Some(status)) => {
                record_remove_failure(&task.manager, task.session_id.as_str());
                if let Err(error) = task
                    .manager
                    .bridge
                    .emit_exited(task.session_id.as_str(), status.as_str())
                {
                    must_record_failure(
                        &task.manager,
                        format!(
                            "failed to emit terminal exited event for {}: {error}",
                            task.session_id
                        ),
                    );
                }
                return;
            }
            Ok(None) => thread::sleep(Duration::from_millis(EXIT_POLL_INTERVAL_MS)),
            Err(error) => {
                record_remove_failure(&task.manager, task.session_id.as_str());
                report_task_failure(&task, &task.manager.bridge, error);
                return;
            }
        }
    }
}

fn report_task_failure(task: &TaskContext, bridge: &TerminalEventBridge, message: String) {
    if let Err(error) = bridge.emit_error(task.session_id.as_str(), message.as_str()) {
        must_record_failure(
            &task.manager,
            format!(
                "terminal background failure for {}: {message}; failed to emit error event: {error}",
                task.session_id
            ),
        );
    }
    if let Err(error) = kill_child(&task.child) {
        must_record_failure(
            &task.manager,
            format!(
                "failed to terminate terminal session {} after background failure: {error}",
                task.session_id
            ),
        );
    }
}

pub(super) fn pty_size(rows: u16, cols: u16) -> PtySize {
    PtySize {
        rows,
        cols,
        pixel_width: PTY_PIXEL_SIZE,
        pixel_height: PTY_PIXEL_SIZE,
    }
}
