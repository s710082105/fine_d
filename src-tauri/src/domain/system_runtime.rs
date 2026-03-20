use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

const UNIX_SHELL_PATH: &str = "/bin/sh";
const MACOS_INSTALLER: &str = "install-runtime-macos.sh";
const WINDOWS_INSTALLER: &str = "install-runtime-windows.cmd";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimePlatform {
    Macos,
    Windows,
    Linux,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CommandInstallationStatus {
    pub installed: bool,
    pub detected_version: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RuntimeInspectionStatus {
    pub git: CommandInstallationStatus,
    pub node: CommandInstallationStatus,
    pub python: CommandInstallationStatus,
    pub codex: CommandInstallationStatus,
    pub hook_shell: Option<PathBuf>,
}

impl RuntimePlatform {
    pub fn current() -> Self {
        if cfg!(target_os = "windows") {
            Self::Windows
        } else if cfg!(target_os = "macos") {
            Self::Macos
        } else {
            Self::Linux
        }
    }
}

pub fn inspect_system_runtime(platform: RuntimePlatform) -> RuntimeInspectionStatus {
    let git = inspect_command(&["git"]);
    RuntimeInspectionStatus {
        node: inspect_command(&["node"]),
        python: inspect_python(platform),
        codex: inspect_command(&["codex"]),
        hook_shell: detect_hook_shell(platform, git.installed),
        git,
    }
}

pub fn resolve_install_script_path(app: &AppHandle, platform: RuntimePlatform) -> Option<PathBuf> {
    install_script_candidates(app, platform)
        .into_iter()
        .find(|candidate| candidate.exists())
}

fn install_script_candidates(app: &AppHandle, platform: RuntimePlatform) -> Vec<PathBuf> {
    let Some(script_name) = install_script_name(platform) else {
        return Vec::new();
    };
    let mut candidates = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("scripts").join(script_name));
        candidates.push(resource_dir.join(script_name));
    }
    candidates.push(PathBuf::from("scripts").join(script_name));
    candidates
}

fn install_script_name(platform: RuntimePlatform) -> Option<&'static str> {
    match platform {
        RuntimePlatform::Macos => Some(MACOS_INSTALLER),
        RuntimePlatform::Windows => Some(WINDOWS_INSTALLER),
        RuntimePlatform::Linux => None,
    }
}

fn inspect_python(platform: RuntimePlatform) -> CommandInstallationStatus {
    match platform {
        RuntimePlatform::Windows => inspect_command(python_candidates(platform)),
        RuntimePlatform::Macos | RuntimePlatform::Linux => inspect_command(python_candidates(platform)),
    }
}

fn python_candidates(platform: RuntimePlatform) -> &'static [&'static str] {
    match platform {
        RuntimePlatform::Windows => &["py", "python3", "python"],
        RuntimePlatform::Macos | RuntimePlatform::Linux => &["python3"],
    }
}

fn inspect_command(candidates: &[&str]) -> CommandInstallationStatus {
    for candidate in candidates {
        match Command::new(candidate).arg("--version").output() {
            Ok(output) if output.status.success() => {
                return CommandInstallationStatus {
                    installed: true,
                    detected_version: detect_version_line(&output.stdout, &output.stderr),
                };
            }
            Ok(_) => continue,
            Err(error) if error.kind() == ErrorKind::NotFound => continue,
            Err(_) => continue,
        }
    }
    CommandInstallationStatus::default()
}

fn detect_version_line(stdout: &[u8], stderr: &[u8]) -> String {
    let primary = String::from_utf8_lossy(stdout);
    if let Some(line) = first_non_empty_line(primary.as_ref()) {
        return line.to_string();
    }
    let fallback = String::from_utf8_lossy(stderr);
    first_non_empty_line(fallback.as_ref())
        .map(ToOwned::to_owned)
        .unwrap_or_default()
}

fn first_non_empty_line(payload: &str) -> Option<&str> {
    payload.lines().map(str::trim).find(|line| !line.is_empty())
}

fn detect_hook_shell(platform: RuntimePlatform, git_installed: bool) -> Option<PathBuf> {
    match platform {
        RuntimePlatform::Windows => detect_windows_git_shell(git_installed),
        RuntimePlatform::Macos | RuntimePlatform::Linux => {
            let shell = PathBuf::from(UNIX_SHELL_PATH);
            shell.exists().then_some(shell)
        }
    }
}

fn detect_windows_git_shell(git_installed: bool) -> Option<PathBuf> {
    if !git_installed {
        return None;
    }
    let exec_path = read_git_exec_path().ok()?;
    for root in exec_path.ancestors().take(4).map(Path::to_path_buf) {
        for candidate in [
            root.join("bin/sh.exe"),
            root.join("usr/bin/sh.exe"),
            root.join("bin/bash.exe"),
        ] {
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}

fn read_git_exec_path() -> Result<PathBuf, String> {
    let output = Command::new("git")
        .arg("--exec-path")
        .output()
        .map_err(|error| format!("failed to resolve git exec path: {error}"))?;
    if output.status.success() {
        return Ok(PathBuf::from(
            String::from_utf8_lossy(&output.stdout).trim(),
        ));
    }
    Err(format!(
        "failed to resolve git exec path: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

#[cfg(test)]
mod tests {
    use super::{install_script_name, python_candidates, RuntimePlatform};

    #[test]
    fn windows_install_script_name_prefers_cmd_wrapper() {
        assert_eq!(
            install_script_name(RuntimePlatform::Windows),
            Some("install-runtime-windows.cmd")
        );
    }

    #[test]
    fn windows_python_candidates_include_py_launcher_first() {
        assert_eq!(
            python_candidates(RuntimePlatform::Windows),
            &["py", "python3", "python"]
        );
    }
}
