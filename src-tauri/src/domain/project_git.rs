use super::project_config::{ProjectConfig, SyncProtocol, PROJECT_SOURCE_SUBDIR};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const HOOK_MARKER: &str = "FINEREPORT_POST_COMMIT_SYNC";
const HOOK_TEMPLATE: &str = include_str!("../../../embedded/templates/post-commit-sync.sh.hbs");

pub fn ensure_project_git_sync(project_dir: &Path, config: &ProjectConfig) -> Result<(), String> {
    fs::create_dir_all(project_dir)
        .map_err(|error| format!("failed to create project directory: {error}"))?;
    ensure_git_repository(project_dir)?;
    install_post_commit_hook(project_dir, config)
}

pub fn uses_git_post_commit_sync(project_dir: &Path) -> Result<bool, String> {
    if !is_git_repository(project_dir)? {
        return Ok(false);
    }
    let hook_path = resolve_git_path(project_dir, "hooks/post-commit")?;
    if !hook_path.exists() {
        return Ok(false);
    }
    let content = fs::read_to_string(&hook_path)
        .map_err(|error| format!("failed to read post-commit hook: {error}"))?;
    Ok(content.contains(HOOK_MARKER))
}

fn ensure_git_repository(project_dir: &Path) -> Result<(), String> {
    if is_git_repository(project_dir)? {
        return Ok(());
    }
    run_git(project_dir, ["init"]).map(|_| ())
}

fn is_git_repository(project_dir: &Path) -> Result<bool, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(project_dir)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output()
        .map_err(|error| format!("failed to execute git rev-parse: {error}"))?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim() == "true");
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("not a git repository") {
        return Ok(false);
    }
    Err(format!(
        "failed to inspect git repository: {}",
        stderr.trim()
    ))
}

fn install_post_commit_hook(project_dir: &Path, config: &ProjectConfig) -> Result<(), String> {
    let hook_path = resolve_git_path(project_dir, "hooks/post-commit")?;
    if hook_path.exists() {
        let existing = fs::read_to_string(&hook_path)
            .map_err(|error| format!("failed to read existing post-commit hook: {error}"))?;
        if !existing.contains(HOOK_MARKER) {
            return Err(format!(
                "existing git post-commit hook is not managed by FineReport: {}",
                hook_path.display()
            ));
        }
    }

    let hook_content = render_post_commit_hook(project_dir, config);
    if let Some(parent) = hook_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create git hooks directory: {error}"))?;
    }
    fs::write(&hook_path, hook_content)
        .map_err(|error| format!("failed to write post-commit hook: {error}"))?;
    set_executable(&hook_path)
}

fn resolve_git_path(project_dir: &Path, target: &str) -> Result<PathBuf, String> {
    let output = run_git(project_dir, ["rev-parse", "--git-path", target])?;
    Ok(project_dir.join(output))
}

fn run_git<const N: usize>(project_dir: &Path, args: [&str; N]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(project_dir)
        .args(args)
        .output()
        .map_err(|error| format!("failed to execute git command: {error}"))?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }
    Err(format!(
        "git command failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    ))
}

fn render_post_commit_hook(project_dir: &Path, config: &ProjectConfig) -> String {
    let remote_root = resolve_reportlets_remote_root(config);
    HOOK_TEMPLATE
        .replace("{{hook_marker}}", HOOK_MARKER)
        .replace(
            "{{project_dir}}",
            &shell_quote(project_dir.to_string_lossy().as_ref()),
        )
        .replace("{{source_subdir}}", &shell_quote(PROJECT_SOURCE_SUBDIR))
        .replace(
            "{{protocol}}",
            &shell_quote(protocol_text(&config.sync.protocol)),
        )
        .replace(
            "{{remote_root}}",
            &shell_quote(remote_root.to_string_lossy().as_ref()),
        )
}

fn resolve_reportlets_remote_root(config: &ProjectConfig) -> PathBuf {
    let remote_root = PathBuf::from(&config.sync.remote_runtime_dir);
    let Some(mapping) = config
        .mappings
        .iter()
        .find(|candidate| candidate.local == PROJECT_SOURCE_SUBDIR)
    else {
        return remote_root;
    };
    remote_root.join(&mapping.remote)
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn protocol_text(protocol: &SyncProtocol) -> &'static str {
    match protocol {
        SyncProtocol::Sftp => "sftp",
        SyncProtocol::Ftp => "ftp",
        SyncProtocol::Local => "local",
    }
}

fn set_executable(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = fs::metadata(path)
            .map_err(|error| format!("failed to stat post-commit hook: {error}"))?;
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(path, permissions)
            .map_err(|error| format!("failed to mark post-commit hook executable: {error}"))
    }
    #[cfg(not(unix))]
    {
        let _ = path;
        Ok(())
    }
}
