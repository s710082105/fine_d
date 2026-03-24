use super::remote_runtime::{RemoteFileEntry, RemoteRuntimeClient};
use std::fs;
use std::path::Path;

const BLANK_CPT_TEMPLATE: &[u8] =
    include_bytes!("../../../embedded/skills/fr-create/assets/blank.cpt");
const BLANK_FVS_TEMPLATE: &[u8] =
    include_bytes!("../../../embedded/skills/fr-create/assets/blank.fvs");

pub fn prepare_remote_create(
    client: &mut dyn RemoteRuntimeClient,
    local_path: &Path,
    remote_path: &str,
) -> Result<(), String> {
    ensure_remote_file_absent(client, remote_path)?;
    client.write_content(remote_path, placeholder_template(remote_path)?)?;
    require_remote_file_ready(client, remote_path, "创建")?;
    sync_remote_to_local(client, remote_path, local_path)
}

pub fn prepare_remote_edit(
    client: &mut dyn RemoteRuntimeClient,
    local_path: &Path,
    remote_path: &str,
) -> Result<(), String> {
    require_remote_file_ready(client, remote_path, "修改")?;
    sync_remote_to_local(client, remote_path, local_path)
}

pub fn sync_remote_upsert(
    client: &mut dyn RemoteRuntimeClient,
    local_path: &Path,
    remote_path: &str,
) -> Result<(), String> {
    require_remote_file_ready(client, remote_path, "同步")?;
    let local_bytes =
        fs::read(local_path).map_err(|error| format!("读取本地同步文件失败：{error}"))?;
    client.write_content(remote_path, &local_bytes)?;
    require_remote_file_ready(client, remote_path, "同步后校验")?;
    let remote_bytes = client.read_file(remote_path)?;
    if remote_bytes != local_bytes {
        return Err(format!("同步未完成：远端文件内容校验失败：`{remote_path}`"));
    }
    Ok(())
}

pub fn sync_remote_delete(
    client: &mut dyn RemoteRuntimeClient,
    remote_path: &str,
) -> Result<(), String> {
    require_remote_file_ready(client, remote_path, "删除")?;
    client.delete_file(remote_path)?;
    if inspect_remote_file(client, remote_path)?.is_some() {
        return Err(format!("同步未完成：远端文件删除后仍存在：`{remote_path}`"));
    }
    Ok(())
}

pub fn inspect_remote_file(
    client: &mut dyn RemoteRuntimeClient,
    remote_path: &str,
) -> Result<Option<RemoteFileEntry>, String> {
    let parent_path = remote_parent_path(remote_path);
    let target_path = normalize_remote_path(remote_path);
    let target_name = remote_leaf_name(target_path.as_str());
    Ok(client
        .list_entries(parent_path.as_str())?
        .into_iter()
        .find(|entry| listed_entry_matches(entry, target_path.as_str(), target_name)))
}

fn sync_remote_to_local(
    client: &mut dyn RemoteRuntimeClient,
    remote_path: &str,
    local_path: &Path,
) -> Result<(), String> {
    let content = client.read_file(remote_path)?;
    if let Some(parent) = local_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建本地目录失败：{error}"))?;
    }
    fs::write(local_path, content).map_err(|error| format!("写入本地文件失败：{error}"))
}

fn ensure_remote_file_absent(
    client: &mut dyn RemoteRuntimeClient,
    remote_path: &str,
) -> Result<(), String> {
    if inspect_remote_file(client, remote_path)?.is_some() {
        return Err(format!("远端文件已存在，禁止重名创建：`{remote_path}`"));
    }
    Ok(())
}

fn require_remote_file_ready(
    client: &mut dyn RemoteRuntimeClient,
    remote_path: &str,
    action: &str,
) -> Result<RemoteFileEntry, String> {
    let Some(entry) = inspect_remote_file(client, remote_path)? else {
        return Err(format!("远端文件不存在，拒绝{action}：`{remote_path}`"));
    };
    if entry.directory {
        return Err(format!("远端路径不是文件，拒绝{action}：`{remote_path}`"));
    }
    if let Some(lock) = entry.lock.as_ref().filter(|value| !value.trim().is_empty()) {
        return Err(format!(
            "远端文件已锁定，拒绝{action}：`{remote_path}`，锁定信息：`{lock}`"
        ));
    }
    Ok(entry)
}

fn remote_parent_path(remote_path: &str) -> String {
    let normalized = normalize_remote_path(remote_path);
    let trimmed = normalized.trim_end_matches('/');
    match trimmed.rsplit_once('/') {
        Some((parent, _)) if !parent.is_empty() => parent.into(),
        Some(_) => "/".into(),
        None => "/".into(),
    }
}

fn listed_entry_matches(entry: &RemoteFileEntry, target_path: &str, target_name: &str) -> bool {
    let entry_path = normalize_remote_path(entry.path.as_str());
    let entry_name = normalize_remote_path(entry.name.as_str());
    entry_path == target_path
        || remote_leaf_name(entry_path.as_str()) == target_name
        || remote_leaf_name(entry_name.as_str()) == target_name
}

fn normalize_remote_path(path: &str) -> String {
    let replaced = path.trim().replace('\\', "/");
    let trimmed = replaced.trim_end_matches('/');
    if trimmed.is_empty() && replaced.starts_with('/') {
        "/".into()
    } else {
        trimmed.into()
    }
}

fn remote_leaf_name(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn placeholder_template(remote_path: &str) -> Result<&'static [u8], String> {
    if remote_path.ends_with(".cpt") {
        return Ok(BLANK_CPT_TEMPLATE);
    }
    if remote_path.ends_with(".fvs") {
        return Ok(BLANK_FVS_TEMPLATE);
    }
    Err(format!("不支持创建该类型的远端占位文件：`{remote_path}`"))
}
