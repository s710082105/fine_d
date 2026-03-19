use serde::Serialize;
use std::io::ErrorKind;
use std::process::Command;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexInstallStatus {
    pub installed: bool,
}

#[tauri::command]
pub fn check_codex_installation() -> Result<CodexInstallStatus, String> {
    match Command::new("codex").arg("--version").output() {
        Ok(output) => Ok(CodexInstallStatus {
            installed: output.status.success(),
        }),
        Err(error) if error.kind() == ErrorKind::NotFound => {
            Ok(CodexInstallStatus { installed: false })
        }
        Err(error) => Err(format!("failed to check codex installation: {error}")),
    }
}
