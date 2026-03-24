use finereport_tauri_shell_lib::domain::context_builder::build_runtime_context;
use finereport_tauri_shell_lib::domain::project_config::{
    ProjectConfig, ProjectMapping, WorkspaceProfile,
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
    config.sync.designer_root = "/Applications/FineReport".into();
    config.sync.remote_runtime_dir = "/srv/tomcat/webapps/webroot/WEB-INF".into();
    config.sync.delete_propagation = true;
    config.sync.auto_sync_on_change = true;
    config.style.instructions = "标题使用蓝灰配色，数字列右对齐，金额统一保留两位小数。".into();
    config.preview.url =
        "http://127.0.0.1:8075/webroot/decision/view/report?viewlet=/demo/table.cpt&op=write"
            .into();
    config.preview.account = "preview-user".into();
    config.preview.password = "preview-pass".into();
    config.ai.api_key = "sk-demo".into();
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
        "continuous-learning".to_string(),
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
    assert!(project_context.contains("protocol: fine"));
    assert!(project_context.contains("designer_root"));
    assert!(project_context.contains("/Applications/FineReport"));
    assert!(project_context.contains("local_source_dir"));
    assert!(project_context.contains("remote_runtime_dir"));
    assert!(project_context.contains("preview_account"));
    assert!(project_context.contains("preview-user"));
    assert!(project_context.contains("preview_password"));
    assert!(project_context.contains("preview-pass"));
    assert!(project_context.contains("op=view"));
    assert!(!project_context.contains("op=write"));
    assert!(project_context.contains("codex_api_key"));
    assert!(project_context.contains("sk-demo"));
    assert!(project_context.contains("style_instructions"));
    assert!(project_context.contains("蓝灰配色"));
    assert!(project_context.contains("设计器远端"));
    assert!(project_context.contains("真实字段"));
    assert!(project_rules.contains("delete_propagation"));
    assert!(project_rules.contains("designer_root"));
    assert!(project_rules.contains("auto_sync_on_change"));
    assert!(project_rules.contains("系统负责执行同步"));
    assert!(project_rules.contains("先读取设计器远端已有数据连接"));
    assert!(project_rules.contains("chrome-cdp"));
    assert!(project_rules.contains("页面复核"));
    assert!(project_rules.contains("客户指出问题并提供学习样本"));
    assert!(project_rules.contains("必须更新相关 skill"));
    assert!(project_rules.contains("op=view"));
    assert!(!project_rules.contains("op=write"));
    assert!(mappings.contains("protocol"));
    assert!(mappings.contains("designer_root"));
    assert!(mappings.contains("preview_account"));
    assert!(mappings.contains("preview_password"));
    assert!(mappings.contains("codex_api_key"));
    assert!(mappings.contains("style_instructions"));
    assert!(mappings.contains("source_target_mappings"));
    assert!(mappings.contains("delete_propagation"));
    assert!(mappings.contains("auto_sync_on_change"));
    assert!(mappings.contains("op=view"));
    assert!(!mappings.contains("op=write"));
    assert!(mappings.contains("reportlets"));
    assert!(mappings.contains("templates"));
    assert!(!project_context.contains("preview_mode"));
    assert!(!project_context.contains("codex_provider"));
    assert!(!project_context.contains("codex_model"));
    assert!(!project_context.contains("codex_base_url"));
    assert!(!project_rules.contains("preview_mode"));
    assert!(!project_rules.contains("codex_provider"));
    assert!(!project_rules.contains("codex_model"));
    assert!(!project_rules.contains("codex_base_url"));
    assert!(!mappings.contains("\"preview_mode\""));
    assert!(!project_context.contains("data_connections"));
    assert!(!project_rules.contains("data_connections"));
    assert!(!mappings.contains("\"data_connections\""));
    assert!(!mappings.contains("\"codex_provider\""));
    assert!(!mappings.contains("\"codex_model\""));
    assert!(!mappings.contains("codex_base_url"));

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
    assert!(context_dir
        .join("skills/continuous-learning/SKILL.md")
        .exists());
    assert!(agents.contains("chrome-cdp"));
    assert!(agents.contains("同步完成后"));
    assert!(agents.contains("查询"));
    assert!(agents.contains("实际数据结果"));
    assert!(project_rules.contains("查询"));
    assert!(project_rules.contains("实际数据结果"));
    let fr_cpt_skill = std::fs::read_to_string(context_dir.join("skills/fr-cpt/SKILL.md"))
        .expect("read fr-cpt skill");
    assert!(fr_cpt_skill.contains("查询"));
    assert!(fr_cpt_skill.contains("实际数据结果"));
    let chrome_cdp_skill = std::fs::read_to_string(context_dir.join("skills/chrome-cdp/SKILL.md"))
        .expect("read chrome-cdp skill");
    assert!(agents.contains("fr-btn-text"));
    assert!(project_rules.contains("button.fr-btn-text.fr-widget-font"));
    assert!(chrome_cdp_skill.contains("button.fr-btn-text.fr-widget-font"));
    assert!(chrome_cdp_skill.contains("textContent?.trim() === '查询'"));
}

#[test]
fn context_builder_appends_view_mode_to_preview_url_without_query() {
    let context_dir = test_context_dir();
    let mut config = ProjectConfig::default();
    config.workspace = WorkspaceProfile {
        name: "demo-workspace".into(),
        root_dir: "/tmp/demo".into(),
    };
    config.preview.url = "http://127.0.0.1:8075/webroot/decision/view/report".into();
    config.preview.account = "preview-user".into();
    config.preview.password = "preview-pass".into();

    build_runtime_context(context_dir.as_path(), &config, &["chrome-cdp".into()])
        .expect("build runtime context");

    let project_context = std::fs::read_to_string(context_dir.join("project-context.md"))
        .expect("read project-context.md");

    assert!(project_context
        .contains("preview_url: http://127.0.0.1:8075/webroot/decision/view/report?op=view"));
}
