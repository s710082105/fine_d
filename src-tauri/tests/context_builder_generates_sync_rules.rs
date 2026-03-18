use finereport_tauri_shell_lib::domain::context_builder::build_runtime_context;
use finereport_tauri_shell_lib::domain::project_config::{
  AiProfile,
  ProjectConfig,
  ProjectMapping,
  StyleProfile,
  SyncProfile,
  SyncProtocol,
  WorkspaceProfile,
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
  let config = ProjectConfig {
    style: StyleProfile {
      theme: "light".into(),
    },
    workspace: WorkspaceProfile {
      name: "demo-workspace".into(),
      root_dir: "/tmp/demo".into(),
    },
    sync: SyncProfile {
      protocol: SyncProtocol::Sftp,
      local_source_dir: "/tmp/demo/reportlets".into(),
      remote_runtime_dir: "/srv/tomcat/webapps/webroot/WEB-INF".into(),
      delete_propagation: true,
      auto_sync_on_change: true,
    },
    ai: AiProfile {
      provider: "openai".into(),
      model: "gpt-5".into(),
    },
    mappings: vec![
      ProjectMapping {
        local: "reportlets".into(),
        remote: "reportlets".into(),
      },
      ProjectMapping {
        local: "templates".into(),
        remote: "templates".into(),
      },
    ],
  };
  let enabled_skills = vec![
    "finereport-template".to_string(),
    "browser-validate".to_string(),
    "sync-publish".to_string(),
  ];

  build_runtime_context(context_dir.as_path(), &config, &enabled_skills)
    .expect("build runtime context");

  let agents = std::fs::read_to_string(context_dir.join("AGENTS.md")).expect("read AGENTS.md");
  let project_context = std::fs::read_to_string(context_dir.join("project-context.md"))
    .expect("read project-context.md");
  let project_rules =
    std::fs::read_to_string(context_dir.join("project-rules.md")).expect("read project-rules.md");
  let mappings = std::fs::read_to_string(context_dir.join("mappings.json"))
    .expect("read mappings.json");

  assert!(agents.contains("FineReport"));
  assert!(project_context.contains("protocol"));
  assert!(project_context.contains("local_source_dir"));
  assert!(project_context.contains("remote_runtime_dir"));
  assert!(project_rules.contains("delete_propagation"));
  assert!(project_rules.contains("auto_sync_on_change"));
  assert!(mappings.contains("protocol"));
  assert!(mappings.contains("source_target_mappings"));
  assert!(mappings.contains("delete_propagation"));
  assert!(mappings.contains("auto_sync_on_change"));
  assert!(mappings.contains("reportlets"));
  assert!(mappings.contains("templates"));

  assert!(context_dir.join("skills/finereport-template/SKILL.md").exists());
  assert!(context_dir.join("skills/browser-validate/SKILL.md").exists());
  assert!(context_dir.join("skills/sync-publish/SKILL.md").exists());
}
