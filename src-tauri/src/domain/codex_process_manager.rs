use super::event_bridge::EventBridge;
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMetadata {
    pub session_id: String,
    pub pid: u32,
    pub command: String,
    pub args: Vec<String>,
    pub working_dir: String,
    pub started_at: String,
}

pub type ProcessExitHook = Arc<dyn Fn(&str) + Send + Sync>;
pub type ProcessStdoutHook = Arc<dyn Fn(&str, &str) + Send + Sync>;

#[derive(Clone)]
pub struct ProcessLaunchConfig {
    pub command: String,
    pub args: Vec<String>,
    pub working_dir: PathBuf,
    pub exit_hook: Option<ProcessExitHook>,
    pub stdout_hook: Option<ProcessStdoutHook>,
}

impl std::fmt::Debug for ProcessLaunchConfig {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("ProcessLaunchConfig")
            .field("command", &self.command)
            .field("args", &self.args)
            .field("working_dir", &self.working_dir)
            .field("exit_hook", &self.exit_hook.as_ref().map(|_| "<hook>"))
            .field("stdout_hook", &self.stdout_hook.as_ref().map(|_| "<hook>"))
            .finish()
    }
}

#[derive(Clone, Default)]
pub struct CodexProcessManager {
    processes: Arc<Mutex<HashMap<String, ProcessMetadata>>>,
}

impl CodexProcessManager {
    pub fn start_process(
        &self,
        session_id: &str,
        config: &ProcessLaunchConfig,
        bridge: &EventBridge,
    ) -> Result<ProcessMetadata, String> {
        if self.contains_session(session_id)? {
            return Err(format!("session process already running: {session_id}"));
        }
        let mut child = spawn_process(config)?;
        let pid = child.id();
        let metadata = build_metadata(session_id, pid, config)?;
        self.insert(metadata.clone())?;

        let stdout = child
            .stdout
            .take()
            .ok_or("failed to capture codex stdout")?;
        let stderr = child
            .stderr
            .take()
            .ok_or("failed to capture codex stderr")?;
        let bridge_for_stdout = bridge.clone();
        let bridge_for_stderr = bridge.clone();
        let bridge_for_exit = bridge.clone();
        let manager_for_exit = self.clone();
        let exit_hook = config.exit_hook.clone();
        let stdout_hook = config.stdout_hook.clone();
        let session_id_for_stdout = session_id.to_string();
        let session_id_for_stderr = session_id.to_string();
        let session_id_for_exit = session_id.to_string();

        thread::spawn(move || {
            stream_output(
                stdout,
                &bridge_for_stdout,
                StreamOutputConfig {
                    session_id: session_id_for_stdout,
                    is_stdout: true,
                    stdout_hook,
                },
            )
        });
        thread::spawn(move || {
            stream_output(
                stderr,
                &bridge_for_stderr,
                StreamOutputConfig {
                    session_id: session_id_for_stderr,
                    is_stdout: false,
                    stdout_hook: None,
                },
            )
        });
        thread::spawn(move || {
            watch_exit(
                child,
                manager_for_exit,
                bridge_for_exit,
                session_id_for_exit,
                exit_hook,
            )
        });
        Ok(metadata)
    }

    pub fn interrupt_process(&self, session_id: &str) -> Result<(), String> {
        let metadata = self.metadata_for(session_id)?;
        let status = Command::new("kill")
            .arg("-INT")
            .arg(metadata.pid.to_string())
            .status()
            .map_err(|error| format!("failed to interrupt codex process: {error}"))?;
        if !status.success() {
            return Err(format!(
                "failed to interrupt codex process: kill exited with {status}"
            ));
        }
        Ok(())
    }

    pub fn contains_session(&self, session_id: &str) -> Result<bool, String> {
        let lock = self
            .processes
            .lock()
            .map_err(|error| format!("failed to acquire process manager lock: {error}"))?;
        Ok(lock.contains_key(session_id))
    }

    fn insert(&self, metadata: ProcessMetadata) -> Result<(), String> {
        let mut lock = self
            .processes
            .lock()
            .map_err(|error| format!("failed to acquire process manager lock: {error}"))?;
        lock.insert(metadata.session_id.clone(), metadata);
        Ok(())
    }

    fn remove(&self, session_id: &str) -> Result<(), String> {
        let mut lock = self
            .processes
            .lock()
            .map_err(|error| format!("failed to acquire process manager lock: {error}"))?;
        lock.remove(session_id);
        Ok(())
    }

    fn metadata_for(&self, session_id: &str) -> Result<ProcessMetadata, String> {
        let lock = self
            .processes
            .lock()
            .map_err(|error| format!("failed to acquire process manager lock: {error}"))?;
        lock.get(session_id)
            .cloned()
            .ok_or_else(|| format!("session process not found: {session_id}"))
    }
}

fn spawn_process(config: &ProcessLaunchConfig) -> Result<std::process::Child, String> {
    Command::new(&config.command)
        .args(&config.args)
        .current_dir(&config.working_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("failed to spawn codex process: {error}"))
}

fn build_metadata(
    session_id: &str,
    pid: u32,
    config: &ProcessLaunchConfig,
) -> Result<ProcessMetadata, String> {
    Ok(ProcessMetadata {
        session_id: session_id.into(),
        pid,
        command: config.command.clone(),
        args: config.args.clone(),
        working_dir: config.working_dir.display().to_string(),
        started_at: unix_timestamp()?,
    })
}

fn stream_output(output: impl Read, bridge: &EventBridge, config: StreamOutputConfig) {
    let reader = BufReader::new(output);
    for line_result in reader.lines() {
        match line_result {
            Ok(line) => {
                run_stdout_hook(&config, line.as_str());
                let emission_result = if config.is_stdout {
                    bridge.emit_stdout(config.session_id.as_str(), line.as_str())
                } else {
                    bridge.emit_stderr(config.session_id.as_str(), line.as_str())
                };
                if let Err(error) = emission_result {
                    eprintln!("{error}");
                }
            }
            Err(error) => {
                let message = format!("failed to read process output: {error}");
                if let Err(emit_error) =
                    bridge.emit_stderr(config.session_id.as_str(), message.as_str())
                {
                    eprintln!("{emit_error}");
                }
            }
        }
    }
}

struct StreamOutputConfig {
    session_id: String,
    is_stdout: bool,
    stdout_hook: Option<ProcessStdoutHook>,
}

fn run_stdout_hook(config: &StreamOutputConfig, line: &str) {
    if !config.is_stdout {
        return;
    }
    let Some(stdout_hook) = &config.stdout_hook else {
        return;
    };
    stdout_hook(config.session_id.as_str(), line);
}

fn watch_exit(
    mut child: std::process::Child,
    manager: CodexProcessManager,
    bridge: EventBridge,
    session_id: String,
    exit_hook: Option<ProcessExitHook>,
) {
    let result = child.wait();
    if let Err(error) = manager.remove(session_id.as_str()) {
        eprintln!("{error}");
    }
    run_exit_hook(&exit_hook, session_id.as_str());
    match result {
        Ok(status) => {
            let message = format!("codex process exited: {status}");
            if let Err(error) = bridge.emit_process_exit(session_id.as_str(), message.as_str()) {
                eprintln!("{error}");
            }
        }
        Err(error) => {
            let message = format!("failed to wait codex process: {error}");
            if let Err(emit_error) = bridge.emit_stderr(session_id.as_str(), message.as_str()) {
                eprintln!("{emit_error}");
            }
        }
    }
}

fn run_exit_hook(exit_hook: &Option<ProcessExitHook>, session_id: &str) {
    let Some(exit_hook) = exit_hook else {
        return;
    };
    exit_hook(session_id);
}

fn unix_timestamp() -> Result<String, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to get unix timestamp: {error}"))?;
    Ok(now.as_secs().to_string())
}
