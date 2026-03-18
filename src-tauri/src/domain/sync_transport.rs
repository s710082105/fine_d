use super::project_config::{SyncProfile, SyncProtocol};
use super::sync_dispatcher::{ResolvedSyncTask, SyncAction};
use ssh2::Session;
use std::env;
use std::fs::File;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use suppaftp::FtpStream;

pub trait SyncTransport: Send + Sync {
  fn apply(&self, task: &ResolvedSyncTask, profile: &SyncProfile) -> Result<(), String>;
}

#[derive(Clone, Default)]
pub struct ProtocolSyncTransport;

impl ProtocolSyncTransport {
  pub fn shared() -> Arc<dyn SyncTransport> {
    Arc::new(Self)
  }
}

impl SyncTransport for ProtocolSyncTransport {
  fn apply(&self, task: &ResolvedSyncTask, profile: &SyncProfile) -> Result<(), String> {
    match profile.protocol {
      SyncProtocol::Sftp => apply_sftp(task, profile),
      SyncProtocol::Ftp => apply_ftp(task, profile),
    }
  }
}

fn apply_sftp(task: &ResolvedSyncTask, profile: &SyncProfile) -> Result<(), String> {
  let password = sync_password()?;
  let tcp = TcpStream::connect((profile.host.as_str(), profile.port))
    .map_err(|error| format!("failed to connect sftp server: {error}"))?;
  let mut session = Session::new().map_err(|error| format!("failed to create ssh session: {error}"))?;
  session.set_tcp_stream(tcp);
  session
    .handshake()
    .map_err(|error| format!("failed to handshake sftp session: {error}"))?;
  session
    .userauth_password(&profile.username, &password)
    .map_err(|error| format!("failed to authenticate sftp session: {error}"))?;
  let sftp = session
    .sftp()
    .map_err(|error| format!("failed to initialize sftp subsystem: {error}"))?;

  match task.action {
    SyncAction::Delete => sftp
      .unlink(Path::new(&task.remote_path))
      .map_err(|error| format!("failed to delete remote file via sftp: {error}")),
    SyncAction::Create | SyncAction::Update => {
      ensure_sftp_directory(&sftp, Path::new(&task.remote_path))?;
      let mut local = File::open(&task.local_path)
        .map_err(|error| format!("failed to open local file for sftp upload: {error}"))?;
      let mut remote = sftp
        .create(Path::new(&task.remote_path))
        .map_err(|error| format!("failed to create remote file via sftp: {error}"))?;
      let mut buffer = Vec::new();
      local
        .read_to_end(&mut buffer)
        .map_err(|error| format!("failed to read local file for sftp upload: {error}"))?;
      remote
        .write_all(&buffer)
        .map_err(|error| format!("failed to upload file via sftp: {error}"))
    }
  }
}

fn ensure_sftp_directory(sftp: &ssh2::Sftp, remote_path: &Path) -> Result<(), String> {
  let Some(parent) = remote_path.parent() else {
    return Ok(());
  };
  let mut current = PathBuf::new();
  for component in parent.components() {
    current.push(component.as_os_str());
    if current.as_os_str().is_empty() {
      continue;
    }
    if sftp.stat(&current).is_ok() {
      continue;
    }
    let _ = sftp.mkdir(&current, 0o755);
  }
  Ok(())
}

fn apply_ftp(task: &ResolvedSyncTask, profile: &SyncProfile) -> Result<(), String> {
  let password = sync_password()?;
  let mut ftp = FtpStream::connect((profile.host.as_str(), profile.port))
    .map_err(|error| format!("failed to connect ftp server: {error}"))?;
  ftp
    .login(&profile.username, &password)
    .map_err(|error| format!("failed to authenticate ftp session: {error}"))?;

  let remote_path = Path::new(&task.remote_path);
  let parent = remote_path.parent().unwrap_or_else(|| Path::new("/"));
  ensure_ftp_directory(&mut ftp, parent)?;

  let file_name = remote_path
    .file_name()
    .ok_or("remote ftp path is missing a file name")?
    .to_string_lossy()
    .to_string();

  let result = match task.action {
    SyncAction::Delete => ftp
      .rm(&file_name)
      .map_err(|error| format!("failed to delete remote file via ftp: {error}")),
    SyncAction::Create | SyncAction::Update => {
      let mut local = File::open(&task.local_path)
        .map_err(|error| format!("failed to open local file for ftp upload: {error}"))?;
      ftp
        .put_file(&file_name, &mut local)
        .map(|_| ())
        .map_err(|error| format!("failed to upload file via ftp: {error}"))
    }
  };

  let _ = ftp.quit();
  result
}

fn ensure_ftp_directory(ftp: &mut FtpStream, parent: &Path) -> Result<(), String> {
  ftp.cwd("/").map_err(|error| format!("failed to cwd ftp root: {error}"))?;
  for component in parent.components() {
    let segment = component.as_os_str().to_string_lossy().to_string();
    if segment.is_empty() || segment == "/" {
      continue;
    }
    if ftp.cwd(&segment).is_ok() {
      continue;
    }
    let _ = ftp.mkdir(&segment);
    ftp.cwd(&segment)
      .map_err(|error| format!("failed to enter ftp directory {segment}: {error}"))?;
  }
  Ok(())
}

fn sync_password() -> Result<String, String> {
  env::var("FINEREPORT_SYNC_PASSWORD")
    .map_err(|_| "FINEREPORT_SYNC_PASSWORD is required for ftp/sftp sync".into())
}
