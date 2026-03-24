use finereport_tauri_shell_lib::domain::remote_runtime::{
    RemoteDirectoryEntry, RemoteFileEntry, RemoteRuntimeClient,
};
use finereport_tauri_shell_lib::domain::remote_sync_guard::{
    prepare_remote_edit, sync_remote_upsert,
};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

fn temp_dir(prefix: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("{prefix}_{nanos}"))
}

#[derive(Clone)]
enum ListPathStyle {
    RelativeName,
    WindowsFull,
}

struct PathStyleClient {
    entries: HashMap<String, Vec<u8>>,
    style: ListPathStyle,
}

impl PathStyleClient {
    fn with_style(style: ListPathStyle) -> Self {
        Self {
            entries: HashMap::from([(
                "reportlets/sales/report.cpt".into(),
                b"remote-template".to_vec(),
            )]),
            style,
        }
    }
}

impl RemoteRuntimeClient for PathStyleClient {
    fn list_directories(&mut self, _path: &str) -> Result<Vec<RemoteDirectoryEntry>, String> {
        Ok(Vec::new())
    }

    fn list_entries(&mut self, path: &str) -> Result<Vec<RemoteFileEntry>, String> {
        if path != "reportlets/sales" {
            return Ok(Vec::new());
        }
        let listed_path: String = match self.style {
            ListPathStyle::RelativeName => "report.cpt".into(),
            ListPathStyle::WindowsFull => r"reportlets\sales\report.cpt".into(),
        };
        Ok(vec![RemoteFileEntry {
            name: listed_path
                .rsplit(['/', '\\'])
                .next()
                .expect("file name")
                .into(),
            path: listed_path,
            directory: false,
            lock: None,
        }])
    }

    fn read_file(&mut self, path: &str) -> Result<Vec<u8>, String> {
        self.entries
            .get(path)
            .cloned()
            .ok_or_else(|| format!("missing remote file: {path}"))
    }

    fn write_content(&mut self, remote_path: &str, content: &[u8]) -> Result<(), String> {
        self.entries
            .insert(remote_path.into(), content.to_vec());
        Ok(())
    }

    fn download_tree(&mut self, _remote_root: &str, _local_root: &Path) -> Result<(), String> {
        Ok(())
    }

    fn upload_file(&mut self, _local_path: &Path, _remote_path: &str) -> Result<(), String> {
        Ok(())
    }

    fn delete_file(&mut self, remote_path: &str) -> Result<(), String> {
        self.entries.remove(remote_path);
        Ok(())
    }
}

#[test]
fn prepare_remote_edit_accepts_parent_listing_with_relative_child_name() {
    let local_root = temp_dir("remote_prepare_edit_relative_name");
    let local_path = local_root.join("reportlets/sales/report.cpt");
    let mut client = PathStyleClient::with_style(ListPathStyle::RelativeName);

    prepare_remote_edit(&mut client, local_path.as_path(), "reportlets/sales/report.cpt")
        .expect("prepare edit should accept child-only list paths");

    assert_eq!(
        fs::read_to_string(local_path).expect("read pulled local file"),
        "remote-template"
    );
}

#[test]
fn sync_remote_upsert_accepts_parent_listing_with_windows_style_path() {
    let local_root = temp_dir("remote_upsert_windows_path");
    let local_path = local_root.join("reportlets/sales/report.cpt");
    fs::create_dir_all(local_path.parent().expect("parent")).expect("create local dir");
    fs::write(&local_path, "updated-template").expect("write local file");
    let mut client = PathStyleClient::with_style(ListPathStyle::WindowsFull);

    sync_remote_upsert(&mut client, local_path.as_path(), "reportlets/sales/report.cpt")
        .expect("sync upsert should accept windows-style list paths");

    assert_eq!(
        client
            .entries
            .get("reportlets/sales/report.cpt")
            .expect("remote content"),
        b"updated-template"
    );
}
