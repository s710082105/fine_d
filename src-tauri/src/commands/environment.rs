use crate::domain::system_runtime::{
    inspect_system_runtime, resolve_install_script_path, CommandInstallationStatus,
    RuntimeInspectionStatus, RuntimePlatform,
};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

const GIT_KEY: &str = "git";
const NODE_KEY: &str = "node";
const PYTHON_KEY: &str = "python";
const CODEX_KEY: &str = "codex";
const PLATFORM_SYNC_KEY: &str = "platform-sync";
const WINDOWS_GIT_SHELL_HINT: &str =
    "Windows 请先执行安装脚本安装 Git，并确保 Git Bash 可用。";
const MACOS_GIT_HINT: &str = "请执行 macOS 安装脚本，或手动安装 Homebrew 后执行 brew install git。";
const MACOS_RUNTIME_HINT: &str =
    "请执行 macOS 安装脚本，并按提示选择官方源或国内源完成环境安装。";
const WINDOWS_RUNTIME_HINT: &str =
    "请执行 Windows 安装脚本，并按提示选择官方源或国内源完成环境安装。";
const LINUX_RUNTIME_HINT: &str = "当前产品未提供 Linux 安装脚本，请手动安装缺失环境。";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexInstallStatus {
    pub installed: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePrerequisiteItem {
    pub key: String,
    pub label: String,
    pub status: String,
    pub blocking: bool,
    pub message: String,
    pub fix_hint: String,
    pub detected_version: String,
    pub script_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePrerequisiteReport {
    pub ready: bool,
    pub items: Vec<RuntimePrerequisiteItem>,
}

#[tauri::command]
pub fn check_runtime_prerequisites(app: AppHandle) -> Result<RuntimePrerequisiteReport, String> {
    let platform = RuntimePlatform::current();
    let inspection = inspect_system_runtime(platform);
    let script_path = resolve_install_script_path(&app, platform);
    Ok(inspect_runtime_prerequisites_with(
        platform,
        inspection,
        script_path.as_deref(),
    ))
}

#[tauri::command]
pub fn check_codex_installation(app: AppHandle) -> Result<CodexInstallStatus, String> {
    let report = check_runtime_prerequisites(app)?;
    let installed = report
        .items
        .iter()
        .find(|item| item.key == CODEX_KEY)
        .map(|item| item.status == "ready")
        .unwrap_or(false);
    Ok(CodexInstallStatus { installed })
}

pub fn inspect_runtime_prerequisites_with(
    platform: RuntimePlatform,
    inspection: RuntimeInspectionStatus,
    script_path: Option<&Path>,
) -> RuntimePrerequisiteReport {
    let installer_path = script_path
        .map(|path| path.display().to_string())
        .unwrap_or_default();
    let items = vec![
        command_item(
            GIT_KEY,
            "Git",
            &inspection.git,
            git_install_hint(platform),
            installer_path.as_str(),
        ),
        command_item(
            NODE_KEY,
            "Node 22",
            &inspection.node,
            runtime_install_hint(platform),
            installer_path.as_str(),
        ),
        command_item(
            PYTHON_KEY,
            "Python 3",
            &inspection.python,
            runtime_install_hint(platform),
            installer_path.as_str(),
        ),
        command_item(
            CODEX_KEY,
            "Codex",
            &inspection.codex,
            runtime_install_hint(platform),
            installer_path.as_str(),
        ),
        platform_sync_item(platform, inspection.hook_shell.as_ref(), installer_path.as_str()),
    ];
    let ready = items
        .iter()
        .all(|item| !item.blocking || item.status == "ready");
    RuntimePrerequisiteReport { ready, items }
}

fn command_item(
    key: &str,
    label: &str,
    status: &CommandInstallationStatus,
    fix_hint: &str,
    script_path: &str,
) -> RuntimePrerequisiteItem {
    if status.installed {
        return ready_item(
            key,
            label,
            format!("已检测到 {label}"),
            status.detected_version.as_str(),
            script_path,
        );
    }
    blocked_item(
        key,
        label,
        format!("未检测到 {label}"),
        fix_hint,
        "",
        script_path,
    )
}

fn platform_sync_item(
    platform: RuntimePlatform,
    hook_shell: Option<&PathBuf>,
    script_path: &str,
) -> RuntimePrerequisiteItem {
    match platform {
        RuntimePlatform::Windows => windows_sync_item(hook_shell, script_path),
        RuntimePlatform::Macos => unix_sync_item("当前发行配置支持 macOS 同步链路", script_path),
        RuntimePlatform::Linux => unix_sync_item("当前发行配置支持 Linux 同步链路", script_path),
    }
}

fn windows_sync_item(hook_shell: Option<&PathBuf>, script_path: &str) -> RuntimePrerequisiteItem {
    match hook_shell {
        Some(shell) => ready_item(
            PLATFORM_SYNC_KEY,
            "同步链路",
            format!("Windows 已检测到 Git hook shell：{}", shell.display()),
            "",
            script_path,
        ),
        None => blocked_item(
            PLATFORM_SYNC_KEY,
            "同步链路",
            "Windows 同步链路依赖 Git Bash/sh.exe".into(),
            WINDOWS_GIT_SHELL_HINT,
            "",
            script_path,
        ),
    }
}

fn unix_sync_item(message: &str, script_path: &str) -> RuntimePrerequisiteItem {
    ready_item(PLATFORM_SYNC_KEY, "同步链路", message.into(), "", script_path)
}

fn ready_item(
    key: &str,
    label: &str,
    message: String,
    detected_version: &str,
    script_path: &str,
) -> RuntimePrerequisiteItem {
    RuntimePrerequisiteItem {
        key: key.into(),
        label: label.into(),
        status: "ready".into(),
        blocking: true,
        message,
        fix_hint: String::new(),
        detected_version: detected_version.into(),
        script_path: script_path.into(),
    }
}

fn blocked_item(
    key: &str,
    label: &str,
    message: String,
    fix_hint: &str,
    detected_version: &str,
    script_path: &str,
) -> RuntimePrerequisiteItem {
    RuntimePrerequisiteItem {
        key: key.into(),
        label: label.into(),
        status: "blocked".into(),
        blocking: true,
        message,
        fix_hint: fix_hint.into(),
        detected_version: detected_version.into(),
        script_path: script_path.into(),
    }
}

fn git_install_hint(platform: RuntimePlatform) -> &'static str {
    match platform {
        RuntimePlatform::Windows => WINDOWS_GIT_SHELL_HINT,
        RuntimePlatform::Macos => MACOS_GIT_HINT,
        RuntimePlatform::Linux => LINUX_RUNTIME_HINT,
    }
}

fn runtime_install_hint(platform: RuntimePlatform) -> &'static str {
    match platform {
        RuntimePlatform::Windows => WINDOWS_RUNTIME_HINT,
        RuntimePlatform::Macos => MACOS_RUNTIME_HINT,
        RuntimePlatform::Linux => LINUX_RUNTIME_HINT,
    }
}
