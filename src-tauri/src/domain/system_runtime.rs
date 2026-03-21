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
    /// 实际检测到的命令路径（可能是 PATH 上的名称或 fallback 绝对路径）
    pub resolved_command: String,
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
    let node = inspect_with_fallbacks(platform, &["node"], windows_node_fallbacks);
    let codex = inspect_with_fallbacks(platform, &["codex"], windows_codex_fallbacks);
    RuntimeInspectionStatus {
        node,
        python: inspect_python(platform),
        codex,
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
        RuntimePlatform::Macos | RuntimePlatform::Linux => {
            inspect_command(python_candidates(platform))
        }
    }
}

fn python_candidates(platform: RuntimePlatform) -> &'static [&'static str] {
    match platform {
        RuntimePlatform::Windows => &["py", "python3", "python"],
        RuntimePlatform::Macos | RuntimePlatform::Linux => &["python3"],
    }
}

/// 先尝试 PATH 上的候选命令，若未找到则在 Windows 上尝试 fallback 绝对路径。
/// GUI 进程的 PATH 可能不包含 npm 全局 bin 等目录（需要注销重登才生效），
/// 因此需要直接探测已知安装位置。
fn inspect_with_fallbacks(
    platform: RuntimePlatform,
    candidates: &[&str],
    win_fallbacks: fn() -> Vec<PathBuf>,
) -> CommandInstallationStatus {
    let result = inspect_command(candidates);
    if result.installed || platform != RuntimePlatform::Windows {
        return result;
    }
    // PATH 上没找到，尝试 Windows 已知安装路径
    let fallbacks: Vec<String> = win_fallbacks()
        .into_iter()
        .filter(|p| p.exists())
        .map(|p| p.display().to_string())
        .collect();
    if fallbacks.is_empty() {
        return result;
    }
    let refs: Vec<&str> = fallbacks.iter().map(|s| s.as_str()).collect();
    inspect_command(&refs)
}

/// Windows 上 node 可能安装在 Program Files 但 GUI 进程 PATH 尚未刷新
fn windows_node_fallbacks() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(pf) = std::env::var("ProgramFiles") {
        paths.push(PathBuf::from(&pf).join("nodejs").join("node.exe"));
    }
    paths
}

/// Windows 上 `npm install -g` 将 codex 安装到 %APPDATA%\npm
fn windows_codex_fallbacks() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        paths.push(PathBuf::from(&appdata).join("npm").join("codex.cmd"));
        paths.push(PathBuf::from(&appdata).join("npm").join("codex"));
    }
    paths
}

fn inspect_command(candidates: &[&str]) -> CommandInstallationStatus {
    for candidate in candidates {
        let mut cmd = Command::new(candidate);
        cmd.arg("--version");
        hide_window(&mut cmd);
        match cmd.output() {
            Ok(output) if output.status.success() => {
                return CommandInstallationStatus {
                    installed: true,
                    detected_version: detect_version_line(&output.stdout, &output.stderr),
                    resolved_command: candidate.to_string(),
                };
            }
            Ok(_) => continue,
            Err(error) if error.kind() == ErrorKind::NotFound => continue,
            Err(_) => continue,
        }
    }
    CommandInstallationStatus::default()
}

/// Windows GUI 进程派生子进程时隐藏控制台窗口
#[cfg(target_os = "windows")]
pub fn hide_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
pub fn hide_window(_cmd: &mut Command) {}

/// 返回当前平台上实际可用的 codex 命令路径
pub fn resolve_codex_command(platform: RuntimePlatform) -> Option<String> {
    let status = inspect_with_fallbacks(platform, &["codex"], windows_codex_fallbacks);
    if status.installed {
        Some(status.resolved_command)
    } else {
        None
    }
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
    let mut cmd = Command::new("git");
    cmd.arg("--exec-path");
    hide_window(&mut cmd);
    let output = cmd
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
