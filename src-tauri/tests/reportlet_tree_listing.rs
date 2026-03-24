use finereport_tauri_shell_lib::commands::project_config::list_reportlet_entries_from_project_dir;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn test_project_dir() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("reportlet_tree_listing_{nanos}"))
}

#[test]
fn list_reportlet_entries_reads_current_directory_only() {
    let project_dir = test_project_dir();
    let reportlets_dir = project_dir.join("reportlets");
    fs::create_dir_all(reportlets_dir.join("sales")).expect("create sales dir");
    fs::create_dir_all(reportlets_dir.join("finance")).expect("create finance dir");
    fs::create_dir_all(reportlets_dir.join(".git")).expect("create hidden dir");
    fs::write(reportlets_dir.join("sales/report.cpt"), "demo").expect("write report file");
    fs::write(reportlets_dir.join(".DS_Store"), "hidden").expect("write hidden file");
    fs::write(reportlets_dir.join(".git/config"), "hidden").expect("write hidden nested file");

    let entries = list_reportlet_entries_from_project_dir(project_dir.as_path(), None)
        .expect("list reportlet entries");

    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].name, "finance");
    assert_eq!(entries[0].path, "finance");
    assert!(entries[0].children.is_empty());
    assert_eq!(entries[1].name, "sales");
    assert_eq!(entries[1].path, "sales");
    assert!(entries[1].children.is_empty());
}

#[test]
fn list_reportlet_entries_reads_requested_child_directory() {
    let project_dir = test_project_dir();
    let reportlets_dir = project_dir.join("reportlets");
    fs::create_dir_all(reportlets_dir.join("sales")).expect("create sales dir");
    fs::write(reportlets_dir.join("sales/report.cpt"), "demo").expect("write report file");

    let entries = list_reportlet_entries_from_project_dir(project_dir.as_path(), Some("sales"))
        .expect("list reportlet child entries");

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].name, "report.cpt");
    assert_eq!(entries[0].path, "sales/report.cpt");
    assert!(entries[0].children.is_empty());
}

#[test]
fn list_reportlet_entries_returns_empty_when_source_dir_missing() {
    let project_dir = test_project_dir();
    let entries = list_reportlet_entries_from_project_dir(project_dir.as_path(), None)
        .expect("list empty reportlets");

    assert!(entries.is_empty());
}
