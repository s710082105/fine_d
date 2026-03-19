use crate::domain::codex_cli::parse_codex_session_id;
use crate::domain::codex_process_manager::{ProcessLaunchConfig, ProcessStdoutHook};
use crate::domain::event_bridge::EventBridge;
use crate::domain::session_store::set_codex_session_id;
use crate::domain::sync_dispatcher::SyncManager;
use std::path::PathBuf;
use std::sync::Arc;

pub fn configure_process_hooks(
    mut launch_config: ProcessLaunchConfig,
    sync_manager: Option<&SyncManager>,
    bridge: &EventBridge,
    manifest_path: PathBuf,
) -> ProcessLaunchConfig {
    if let Some(sync_manager) = sync_manager.cloned() {
        launch_config.exit_hook = Some(Arc::new(move |session_id| {
            sync_manager.stop_session(session_id);
        }));
    }
    launch_config.stdout_hook = Some(build_codex_session_hook(bridge.clone(), manifest_path));
    launch_config
}

fn build_codex_session_hook(bridge: EventBridge, manifest_path: PathBuf) -> ProcessStdoutHook {
    Arc::new(move |session_id, line| {
        let Some(codex_session_id) = parse_codex_session_id(line) else {
            return;
        };
        if let Err(error) = set_codex_session_id(&manifest_path, codex_session_id.as_str()) {
            eprintln!("{error}");
            return;
        }
        if let Err(error) = bridge.emit_codex_session_ready(session_id, codex_session_id.as_str()) {
            eprintln!("{error}");
        }
    })
}
