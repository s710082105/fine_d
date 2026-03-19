use finereport_tauri_shell_lib::domain::context_builder::build_runtime_context;
use finereport_tauri_shell_lib::domain::project_config::{
    DataConnectionProfile, ProjectConfig, ProjectMapping, WorkspaceProfile,
};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn test_context_dir() -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!("context_builder_{nanos}/context"))
}

#[test]
fn context_builder_generates_sync_rules() {
    let context_dir = test_context_dir();
    let mut config = ProjectConfig::default();
    config.workspace = WorkspaceProfile {
        name: "demo-workspace".into(),
        root_dir: "/tmp/demo".into(),
    };
    config.sync.host = "files.example.com".into();
    config.sync.port = 22;
    config.sync.username = "deploy".into();
    config.sync.remote_runtime_dir = "/srv/tomcat/webapps/webroot/WEB-INF".into();
    config.sync.delete_propagation = true;
    config.sync.auto_sync_on_change = true;
    config.data_connections = vec![
        DataConnectionProfile {
            connection_name: "FR Demo".into(),
            dsn: "mysql://127.0.0.1:3306/demo".into(),
            username: "report".into(),
            password: "secret-1".into(),
        },
        DataConnectionProfile {
            connection_name: "Analytics".into(),
            dsn: "mysql://127.0.0.1:3306/analytics".into(),
            username: "analytics".into(),
            password: "secret-2".into(),
        },
    ];
    config.mappings = vec![
        ProjectMapping {
            local: "reportlets".into(),
            remote: "reportlets".into(),
        },
        ProjectMapping {
            local: "templates".into(),
            remote: "templates".into(),
        },
    ];
    let enabled_skills = vec![
        "fr-cpt".to_string(),
        "fr-create".to_string(),
        "fr-db".to_string(),
        "fr-fvs".to_string(),
        "chrome-cdp".to_string(),
    ];

    build_runtime_context(context_dir.as_path(), &config, &enabled_skills)
        .expect("build runtime context");

    let agents = std::fs::read_to_string(context_dir.join("AGENTS.md")).expect("read AGENTS.md");
    let project_context = std::fs::read_to_string(context_dir.join("project-context.md"))
        .expect("read project-context.md");
    let project_rules = std::fs::read_to_string(context_dir.join("project-rules.md"))
        .expect("read project-rules.md");
    let mappings =
        std::fs::read_to_string(context_dir.join("mappings.json")).expect("read mappings.json");

    assert!(agents.contains("FineReport"));
    assert!(project_context.contains("protocol"));
    assert!(project_context.contains("files.example.com"));
    assert!(project_context.contains("deploy"));
    assert!(project_context.contains("local_source_dir"));
    assert!(project_context.contains("remote_runtime_dir"));
    assert!(project_context.contains("preview_mode"));
    assert!(project_context.contains("FR Demo"));
    assert!(project_context.contains("mysql://127.0.0.1:3306/demo"));
    assert!(project_context.contains("secret-1"));
    assert!(project_rules.contains("delete_propagation"));
    assert!(project_rules.contains("port"));
    assert!(project_rules.contains("auto_sync_on_change"));
    assert!(project_rules.contains("系统负责执行同步"));
    assert!(project_rules.contains("Analytics"));
    assert!(project_rules.contains("secret-2"));
    assert!(mappings.contains("protocol"));
    assert!(mappings.contains("host"));
    assert!(mappings.contains("username"));
    assert!(mappings.contains("source_target_mappings"));
    assert!(mappings.contains("delete_propagation"));
    assert!(mappings.contains("auto_sync_on_change"));
    assert!(mappings.contains("data_connections"));
    assert!(mappings.contains("mysql://127.0.0.1:3306/analytics"));
    assert!(mappings.contains("reportlets"));
    assert!(mappings.contains("templates"));

    assert!(context_dir.join("skills/fr-cpt/SKILL.md").exists());
    assert!(context_dir
        .join("skills/fr-cpt/references/cpt-xml-reference.md")
        .exists());
    assert!(context_dir
        .join("skills/fr-create/assets/blank.cpt")
        .exists());
    assert!(context_dir
        .join("skills/fr-fvs/scripts/fvs_helper.py")
        .exists());
    assert!(context_dir
        .join("skills/chrome-cdp/scripts/cdp.mjs")
        .exists());
}
