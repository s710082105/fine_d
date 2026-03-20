use finereport_tauri_shell_lib::commands::environment::{
    inspect_runtime_prerequisites_with,
};
use finereport_tauri_shell_lib::domain::system_runtime::{
    CommandInstallationStatus, RuntimeInspectionStatus, RuntimePlatform,
};
use std::path::Path;

#[test]
fn runtime_prerequisites_report_blocking_items_when_system_runtime_missing() {
    let report = inspect_runtime_prerequisites_with(
        RuntimePlatform::Macos,
        RuntimeInspectionStatus {
            hook_shell: Some("/bin/sh".into()),
            ..RuntimeInspectionStatus::default()
        },
        Some(Path::new("scripts/install-runtime-macos.sh")),
    );

    assert!(!report.ready);
    assert!(report.items.iter().any(|item| item.key == "node" && item.blocking));
    assert!(report.items.iter().any(|item| item.key == "codex" && item.blocking));
    assert!(report.items.iter().any(|item| item.key == "python" && item.blocking));
}

#[test]
fn runtime_prerequisites_report_git_install_hint_for_windows() {
    let report = inspect_runtime_prerequisites_with(
        RuntimePlatform::Windows,
        RuntimeInspectionStatus::default(),
        Some(Path::new("scripts/install-runtime-windows.cmd")),
    );
    let git = report
        .items
        .iter()
        .find(|item| item.key == "git")
        .expect("git item");
    let platform = report
        .items
        .iter()
        .find(|item| item.key == "platform-sync")
        .expect("platform item");

    assert!(!report.ready);
    assert_eq!(git.status, "blocked");
    assert!(git.blocking);
    assert!(git.fix_hint.contains("安装脚本"));
    assert_eq!(git.script_path, "scripts/install-runtime-windows.cmd");
    assert_eq!(platform.status, "blocked");
    assert!(platform.message.contains("Git Bash"));
}

#[test]
fn runtime_prerequisites_report_windows_shell_gap_explicitly() {
    let report = inspect_runtime_prerequisites_with(
        RuntimePlatform::Windows,
        RuntimeInspectionStatus {
            git: CommandInstallationStatus {
                installed: true,
                detected_version: "git version 2.49.0".into(),
            },
            node: CommandInstallationStatus {
                installed: true,
                detected_version: "v22.15.0".into(),
            },
            python: CommandInstallationStatus {
                installed: true,
                detected_version: "Python 3.12.9".into(),
            },
            codex: CommandInstallationStatus {
                installed: true,
                detected_version: "codex-cli 0.116.0".into(),
            },
            hook_shell: None,
        },
        Some(Path::new("scripts/install-runtime-windows.cmd")),
    );
    let platform = report
        .items
        .iter()
        .find(|item| item.key == "platform-sync")
        .expect("platform item");

    assert!(!report.ready);
    assert_eq!(platform.status, "blocked");
    assert!(platform.message.contains("sh.exe"));
}

#[test]
fn runtime_prerequisites_ready_when_system_runtime_and_git_are_available() {
    let report = inspect_runtime_prerequisites_with(
        RuntimePlatform::Macos,
        RuntimeInspectionStatus {
            git: CommandInstallationStatus {
                installed: true,
                detected_version: "git version 2.49.0".into(),
            },
            node: CommandInstallationStatus {
                installed: true,
                detected_version: "v24.8.0".into(),
            },
            python: CommandInstallationStatus {
                installed: true,
                detected_version: "Python 3.14.0".into(),
            },
            codex: CommandInstallationStatus {
                installed: true,
                detected_version: "codex-cli 0.116.0".into(),
            },
            hook_shell: Some("/bin/sh".into()),
        },
        Some(Path::new("scripts/install-runtime-macos.sh")),
    );

    assert!(report.ready);
    assert!(report.items.iter().all(|item| item.status == "ready"));
    assert!(report
        .items
        .iter()
        .any(|item| item.key == "node" && item.detected_version == "v24.8.0"));
}
