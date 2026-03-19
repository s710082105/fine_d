use super::project_config::{SyncProfile, SyncProtocol};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub trait RuntimeSyncBootstrapper: Send + Sync {
    fn replace_project_tree(&self, source_root: &Path, profile: &SyncProfile)
        -> Result<(), String>;
}

#[derive(Clone, Default)]
pub struct ProtocolRuntimeSyncBootstrapper;

impl RuntimeSyncBootstrapper for ProtocolRuntimeSyncBootstrapper {
    fn replace_project_tree(
        &self,
        source_root: &Path,
        profile: &SyncProfile,
    ) -> Result<(), String> {
        if profile.protocol != SyncProtocol::Local {
            return Err(format!(
                "full runtime bootstrap for {} is not implemented yet",
                protocol_text(&profile.protocol)
            ));
        }
        replace_local_project_tree(source_root, Path::new(&profile.remote_runtime_dir))
    }
}

fn replace_local_project_tree(source_root: &Path, runtime_root: &Path) -> Result<(), String> {
    validate_runtime_root(runtime_root)?;
    validate_local_roots(source_root, runtime_root)?;
    reset_project_source_root(source_root)?;
    copy_local_tree(runtime_root, source_root)?;
    import_versioned_reports(source_root, runtime_root)
}

fn validate_runtime_root(runtime_root: &Path) -> Result<(), String> {
    let metadata = fs::metadata(runtime_root)
        .map_err(|error| format!("failed to read runtime directory: {error}"))?;
    if !metadata.is_dir() {
        return Err(format!(
            "runtime directory is not a folder: {}",
            runtime_root.display()
        ));
    }
    Ok(())
}

fn validate_local_roots(source_root: &Path, runtime_root: &Path) -> Result<(), String> {
    if source_root == runtime_root {
        return Err("运行目录不能与项目源码目录相同".into());
    }
    if source_root.starts_with(runtime_root) || runtime_root.starts_with(source_root) {
        return Err("运行目录不能与项目源码目录互相包含".into());
    }
    Ok(())
}

fn reset_project_source_root(source_root: &Path) -> Result<(), String> {
    if source_root.exists() {
        fs::remove_dir_all(source_root)
            .map_err(|error| format!("failed to reset project source directory: {error}"))?;
    }
    fs::create_dir_all(source_root)
        .map_err(|error| format!("failed to create project source directory: {error}"))
}

fn copy_local_tree(source_root: &Path, runtime_root: &Path) -> Result<(), String> {
    for entry in fs::read_dir(source_root)
        .map_err(|error| format!("failed to read bootstrap source directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("failed to read source entry: {error}"))?;
        copy_local_entry(
            entry.path().as_path(),
            runtime_root.join(entry.file_name()).as_path(),
        )?;
    }
    Ok(())
}

fn copy_local_entry(source_path: &Path, runtime_path: &Path) -> Result<(), String> {
    let metadata = fs::metadata(source_path)
        .map_err(|error| format!("failed to read source entry metadata: {error}"))?;
    if metadata.is_dir() {
        fs::create_dir_all(runtime_path)
            .map_err(|error| format!("failed to create runtime directory: {error}"))?;
        return copy_local_tree(source_path, runtime_path);
    }
    if let Some(parent) = runtime_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create runtime directory: {error}"))?;
    }
    fs::copy(source_path, runtime_path)
        .map(|_| ())
        .map_err(|error| format!("failed to copy runtime file: {error}"))
}

fn import_versioned_reports(source_root: &Path, runtime_root: &Path) -> Result<(), String> {
    let versions_root = resolve_versions_root(runtime_root);
    if !versions_root.is_dir() {
        return Ok(());
    }
    let candidates = collect_version_candidates(versions_root.as_path())?;
    for (logical_name, candidate) in candidates {
        let target_path = source_root.join(logical_name);
        if target_path.exists() {
            continue;
        }
        copy_local_entry(candidate.path.as_path(), target_path.as_path())?;
    }
    Ok(())
}

fn resolve_versions_root(runtime_root: &Path) -> PathBuf {
    runtime_root
        .parent()
        .map(|parent| parent.join("reportlets_versions"))
        .unwrap_or_else(|| PathBuf::from("reportlets_versions"))
}

fn collect_version_candidates(
    versions_root: &Path,
) -> Result<HashMap<String, VersionCandidate>, String> {
    let mut candidates: HashMap<String, VersionCandidate> = HashMap::new();
    for entry in fs::read_dir(versions_root)
        .map_err(|error| format!("failed to read reportlets_versions directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("failed to read version entry: {error}"))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(candidate) = parse_version_candidate(path.as_path()) else {
            continue;
        };
        match candidates.get(&candidate.logical_name) {
            Some(current) if current.rank >= candidate.rank => {}
            _ => {
                candidates.insert(candidate.logical_name.clone(), candidate);
            }
        }
    }
    Ok(candidates)
}

fn parse_version_candidate(path: &Path) -> Option<VersionCandidate> {
    let file_name = path.file_name()?.to_string_lossy();
    if let Some(logical_name) = file_name.strip_suffix(".r") {
        return Some(VersionCandidate::new(logical_name, 0, path));
    }
    let (logical_name, version_text) = file_name.rsplit_once(".v")?;
    let rank = version_text.parse::<u32>().ok()?;
    Some(VersionCandidate::new(logical_name, rank, path))
}

struct VersionCandidate {
    logical_name: String,
    rank: u32,
    path: PathBuf,
}

impl VersionCandidate {
    fn new(logical_name: &str, rank: u32, path: &Path) -> Self {
        Self {
            logical_name: logical_name.to_string(),
            rank,
            path: path.to_path_buf(),
        }
    }
}

fn protocol_text(protocol: &SyncProtocol) -> &'static str {
    match protocol {
        SyncProtocol::Sftp => "sftp",
        SyncProtocol::Ftp => "ftp",
        SyncProtocol::Local => "local",
    }
}
