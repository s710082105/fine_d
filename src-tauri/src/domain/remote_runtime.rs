use super::project_config::{SyncProfile, SyncProtocol};
use serde::Serialize;
use ssh2::Session;
use std::fs;
use std::fs::File;
use std::io::Write;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use suppaftp::list::File as FtpListFile;
use suppaftp::FtpStream;
const SFTP_FILE_TYPE_MASK: u32 = 0o170000;
const SFTP_DIRECTORY_FLAG: u32 = 0o040000;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDirectoryEntry {
    pub name: String,
    pub path: String,
    pub children: Vec<RemoteDirectoryEntry>,
}
pub trait RemoteRuntimeClient: Send {
    fn list_directories(&mut self, path: &str) -> Result<Vec<RemoteDirectoryEntry>, String>;
    fn download_tree(&mut self, remote_root: &str, local_root: &Path) -> Result<(), String>;
    fn upload_file(&mut self, local_path: &Path, remote_path: &str) -> Result<(), String>;
    fn delete_file(&mut self, remote_path: &str) -> Result<(), String>;
}
pub trait RemoteRuntimeClientFactory: Send + Sync {
    fn connect(&self, profile: &SyncProfile) -> Result<Box<dyn RemoteRuntimeClient>, String>;
}
#[derive(Clone, Default)]
pub struct ProtocolRemoteRuntimeFactory;
impl ProtocolRemoteRuntimeFactory {
    pub fn shared() -> Arc<dyn RemoteRuntimeClientFactory> {
        Arc::new(Self)
    }
}
impl RemoteRuntimeClientFactory for ProtocolRemoteRuntimeFactory {
    fn connect(&self, profile: &SyncProfile) -> Result<Box<dyn RemoteRuntimeClient>, String> {
        match profile.protocol {
            SyncProtocol::Sftp => connect_sftp(profile),
            SyncProtocol::Ftp => connect_ftp(profile),
            SyncProtocol::Local => Err("remote runtime client does not support local protocol".into()),
        }
    }
}
struct SftpRuntimeClient {
    sftp: ssh2::Sftp,
}
struct FtpRuntimeClient {
    ftp: FtpStream,
}
impl RemoteRuntimeClient for SftpRuntimeClient {
    fn list_directories(&mut self, path: &str) -> Result<Vec<RemoteDirectoryEntry>, String> {
        list_sftp_directories(&self.sftp, normalize_remote_path(path))
    }
    fn download_tree(&mut self, remote_root: &str, local_root: &Path) -> Result<(), String> {
        download_sftp_tree(&self.sftp, normalize_remote_path(remote_root), local_root)
    }
    fn upload_file(&mut self, local_path: &Path, remote_path: &str) -> Result<(), String> {
        ensure_sftp_directory(&self.sftp, Path::new(remote_path))?;
        let mut local = File::open(local_path)
            .map_err(|error| format!("failed to open local file for sftp upload: {error}"))?;
        let mut remote = self
            .sftp
            .create(Path::new(remote_path))
            .map_err(|error| format!("failed to create remote file via sftp: {error}"))?;
        std::io::copy(&mut local, &mut remote)
            .map(|_| ())
            .map_err(|error| format!("failed to upload file via sftp: {error}"))
    }
    fn delete_file(&mut self, remote_path: &str) -> Result<(), String> {
        self.sftp
            .unlink(Path::new(remote_path))
            .map_err(|error| format!("failed to delete remote file via sftp: {error}"))
    }
}
impl RemoteRuntimeClient for FtpRuntimeClient {
    fn list_directories(&mut self, path: &str) -> Result<Vec<RemoteDirectoryEntry>, String> {
        list_ftp_directories(&mut self.ftp, normalize_remote_path(path))
    }
    fn download_tree(&mut self, remote_root: &str, local_root: &Path) -> Result<(), String> {
        download_ftp_tree(&mut self.ftp, normalize_remote_path(remote_root), local_root)
    }
    fn upload_file(&mut self, local_path: &Path, remote_path: &str) -> Result<(), String> {
        let remote_path = normalize_remote_path(remote_path);
        let parent = parent_remote_path(&remote_path);
        ensure_ftp_directory(&mut self.ftp, &parent)?;
        let name = file_name_from_remote_path(&remote_path)?;
        let mut local = File::open(local_path)
            .map_err(|error| format!("failed to open local file for ftp upload: {error}"))?;
        self.ftp
            .put_file(&name, &mut local)
            .map(|_| ())
            .map_err(|error| format!("failed to upload file via ftp: {error}"))
    }
    fn delete_file(&mut self, remote_path: &str) -> Result<(), String> {
        let remote_path = normalize_remote_path(remote_path);
        let parent = parent_remote_path(&remote_path);
        ensure_ftp_directory(&mut self.ftp, &parent)?;
        self.ftp
            .rm(file_name_from_remote_path(&remote_path)?)
            .map_err(|error| format!("failed to delete remote file via ftp: {error}"))
    }
}
impl Drop for FtpRuntimeClient {
    fn drop(&mut self) {
        let _ = self.ftp.quit();
    }
}
fn connect_sftp(profile: &SyncProfile) -> Result<Box<dyn RemoteRuntimeClient>, String> {
    let tcp = TcpStream::connect((profile.host.as_str(), profile.port))
        .map_err(|error| format!("failed to connect sftp server: {error}"))?;
    let mut session =
        Session::new().map_err(|error| format!("failed to create ssh session: {error}"))?;
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|error| format!("failed to handshake sftp session: {error}"))?;
    session
        .userauth_password(&profile.username, &profile.password)
        .map_err(|error| format!("failed to authenticate sftp session: {error}"))?;
    let sftp = session
        .sftp()
        .map_err(|error| format!("failed to initialize sftp subsystem: {error}"))?;
    Ok(Box::new(SftpRuntimeClient { sftp }))
}
fn connect_ftp(profile: &SyncProfile) -> Result<Box<dyn RemoteRuntimeClient>, String> {
    let mut ftp = FtpStream::connect((profile.host.as_str(), profile.port))
        .map_err(|error| format!("failed to connect ftp server: {error}"))?;
    ftp.login(&profile.username, &profile.password)
        .map_err(|error| format!("failed to authenticate ftp session: {error}"))?;
    Ok(Box::new(FtpRuntimeClient { ftp }))
}
fn list_sftp_directories(sftp: &ssh2::Sftp, path: String) -> Result<Vec<RemoteDirectoryEntry>, String> {
    let mut entries = sftp
        .readdir(Path::new(&path))
        .map_err(|error| format!("failed to read remote sftp directory: {error}"))?
        .into_iter()
        .filter_map(|(entry_path, stat)| build_sftp_directory_entry(entry_path, stat))
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(entries)
}
fn build_sftp_directory_entry(path: PathBuf, stat: ssh2::FileStat) -> Option<RemoteDirectoryEntry> {
    let name = path.file_name()?.to_string_lossy().to_string();
    if name == "." || name == ".." || !is_sftp_directory(&stat) {
        return None;
    }
    Some(RemoteDirectoryEntry {
        name,
        path: path.to_string_lossy().replace('\\', "/"),
        children: Vec::new(),
    })
}
fn download_sftp_tree(sftp: &ssh2::Sftp, remote_dir: String, local_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(local_dir).map_err(|error| format!("failed to create local directory: {error}"))?;
    for (path, stat) in sftp
        .readdir(Path::new(&remote_dir))
        .map_err(|error| format!("failed to read remote sftp directory: {error}"))?
    {
        let Some(name) = path.file_name().map(|value| value.to_string_lossy().to_string()) else {
            continue;
        };
        if name == "." || name == ".." {
            continue;
        }
        let target = local_dir.join(&name);
        if is_sftp_directory(&stat) {
            download_sftp_tree(sftp, path.to_string_lossy().replace('\\', "/"), &target)?;
            continue;
        }
        let mut remote = sftp
            .open(path.as_path())
            .map_err(|error| format!("failed to open remote sftp file: {error}"))?;
        let mut local = File::create(&target)
            .map_err(|error| format!("failed to create local bootstrap file: {error}"))?;
        std::io::copy(&mut remote, &mut local)
            .map_err(|error| format!("failed to download remote sftp file: {error}"))?;
    }
    Ok(())
}
fn list_ftp_directories(ftp: &mut FtpStream, path: String) -> Result<Vec<RemoteDirectoryEntry>, String> {
    let mut entries = ftp
        .mlsd(Some(&path))
        .map_err(|error| format!("failed to read remote ftp directory: {error}"))?
        .into_iter()
        .filter_map(|line| build_ftp_directory_entry(&path, &line))
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(entries)
}
fn build_ftp_directory_entry(path: &str, line: &str) -> Option<RemoteDirectoryEntry> {
    let entry = FtpListFile::from_mlsx_line(line).ok()?;
    if !entry.is_directory() || entry.name() == "." || entry.name() == ".." {
        return None;
    }
    Some(RemoteDirectoryEntry {
        name: entry.name().to_string(),
        path: join_remote_path(path, entry.name()),
        children: Vec::new(),
    })
}
fn download_ftp_tree(ftp: &mut FtpStream, remote_dir: String, local_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(local_dir).map_err(|error| format!("failed to create local directory: {error}"))?;
    for line in ftp
        .mlsd(Some(&remote_dir))
        .map_err(|error| format!("failed to read remote ftp directory: {error}"))?
    {
        let entry = FtpListFile::from_mlsx_line(&line)
            .map_err(|error| format!("failed to parse ftp directory entry: {error}"))?;
        if entry.name() == "." || entry.name() == ".." {
            continue;
        }
        let remote_path = join_remote_path(&remote_dir, entry.name());
        let local_path = local_dir.join(entry.name());
        if entry.is_directory() {
            download_ftp_tree(ftp, remote_path, &local_path)?;
            continue;
        }
        let mut buffer = ftp
            .retr_as_buffer(&remote_path)
            .map_err(|error| format!("failed to download remote ftp file: {error}"))?;
        let mut local = File::create(&local_path)
            .map_err(|error| format!("failed to create local bootstrap file: {error}"))?;
        local.write_all(buffer.get_mut())
            .map_err(|error| format!("failed to write local bootstrap file: {error}"))?;
    }
    Ok(())
}
fn ensure_sftp_directory(sftp: &ssh2::Sftp, remote_path: &Path) -> Result<(), String> {
    let Some(parent) = remote_path.parent() else {
        return Ok(());
    };
    let mut current = PathBuf::new();
    for component in parent.components() {
        current.push(component.as_os_str());
        if current.as_os_str().is_empty() || sftp.stat(&current).is_ok() {
            continue;
        }
        let _ = sftp.mkdir(&current, 0o755);
    }
    Ok(())
}
fn ensure_ftp_directory(ftp: &mut FtpStream, parent: &str) -> Result<(), String> {
    ftp.cwd("/").map_err(|error| format!("failed to cwd ftp root: {error}"))?;
    for segment in parent.split('/').filter(|value| !value.is_empty()) {
        if ftp.cwd(segment).is_ok() {
            continue;
        }
        let _ = ftp.mkdir(segment);
        ftp.cwd(segment)
            .map_err(|error| format!("failed to enter ftp directory {segment}: {error}"))?;
    }
    Ok(())
}
fn is_sftp_directory(stat: &ssh2::FileStat) -> bool {
    stat.perm
        .map(|perm| perm & SFTP_FILE_TYPE_MASK == SFTP_DIRECTORY_FLAG)
        .unwrap_or(false)
}
fn normalize_remote_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() { "/".into() } else { trimmed.replace('\\', "/") }
}
fn join_remote_path(parent: &str, name: &str) -> String {
    if parent == "/" { format!("/{name}") } else { format!("{}/{}", parent.trim_end_matches('/'), name) }
}
fn parent_remote_path(path: &str) -> String {
    Path::new(path)
        .parent()
        .map(|value| value.to_string_lossy().replace('\\', "/"))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "/".into())
}
fn file_name_from_remote_path(path: &str) -> Result<String, String> {
    Path::new(path)
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "remote path is missing a file name".into())
}
