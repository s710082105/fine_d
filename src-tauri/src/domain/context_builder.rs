use super::project_config::{ProjectConfig, SyncProtocol};
use std::fs;
use std::io;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

const BASE_AGENT: &str = include_str!("../../../embedded/agents/base/AGENTS.md");
const SKILL_FINEREPORT_TEMPLATE: &str =
  include_str!("../../../embedded/skills/finereport-template/SKILL.md");
const SKILL_BROWSER_VALIDATE: &str =
  include_str!("../../../embedded/skills/browser-validate/SKILL.md");
const SKILL_SYNC_PUBLISH: &str = include_str!("../../../embedded/skills/sync-publish/SKILL.md");
const TEMPLATE_PROJECT_CONTEXT: &str =
  include_str!("../../../embedded/templates/project-context.md.hbs");
const TEMPLATE_PROJECT_RULES: &str = include_str!("../../../embedded/templates/project-rules.md.hbs");
const TEMPLATE_MAPPINGS: &str = include_str!("../../../embedded/templates/mappings.json.hbs");

pub fn build_runtime_context(
  context_dir: &Path,
  config: &ProjectConfig,
  enabled_skills: &[String],
) -> io::Result<()> {
  fs::create_dir_all(context_dir)?;
  write_text(context_dir.join("AGENTS.md"), BASE_AGENT)?;
  let skills_dir = context_dir.join("skills");
  fs::create_dir_all(&skills_dir)?;
  copy_enabled_skills(&skills_dir, enabled_skills)?;
  write_text(
    context_dir.join("project-context.md"),
    &render_project_context(config, enabled_skills),
  )?;
  write_text(
    context_dir.join("project-rules.md"),
    &render_project_rules(config),
  )?;
  write_text(context_dir.join("mappings.json"), &render_mappings(config)?)?;
  Ok(())
}

fn copy_enabled_skills(skills_dir: &Path, enabled_skills: &[String]) -> io::Result<()> {
  for skill_name in enabled_skills {
    let skill_content = resolve_skill(skill_name)?;
    let skill_path = skills_dir.join(skill_name);
    fs::create_dir_all(&skill_path)?;
    write_text(skill_path.join("SKILL.md"), skill_content)?;
  }
  Ok(())
}

fn resolve_skill(skill_name: &str) -> io::Result<&'static str> {
  match skill_name {
    "finereport-template" => Ok(SKILL_FINEREPORT_TEMPLATE),
    "browser-validate" => Ok(SKILL_BROWSER_VALIDATE),
    "sync-publish" => Ok(SKILL_SYNC_PUBLISH),
    _ => Err(io::Error::new(
      ErrorKind::InvalidInput,
      format!("unsupported skill: {skill_name}"),
    )),
  }
}

fn render_project_context(config: &ProjectConfig, enabled_skills: &[String]) -> String {
  render_template(
    TEMPLATE_PROJECT_CONTEXT,
    &[
      ("workspace_name", config.workspace.name.clone()),
      ("workspace_root_dir", config.workspace.root_dir.clone()),
      ("protocol", protocol_text(&config.sync.protocol).to_string()),
      ("local_source_dir", config.sync.local_source_dir.clone()),
      ("remote_runtime_dir", config.sync.remote_runtime_dir.clone()),
      ("enabled_skills", markdown_skill_list(enabled_skills)),
      ("source_target_mappings", markdown_mapping_list(config)),
    ],
  )
}

fn render_project_rules(config: &ProjectConfig) -> String {
  render_template(
    TEMPLATE_PROJECT_RULES,
    &[
      ("protocol", protocol_text(&config.sync.protocol).to_string()),
      ("local_source_dir", config.sync.local_source_dir.clone()),
      ("remote_runtime_dir", config.sync.remote_runtime_dir.clone()),
      (
        "delete_propagation",
        bool_text(config.sync.delete_propagation).to_string(),
      ),
      (
        "auto_sync_on_change",
        bool_text(config.sync.auto_sync_on_change).to_string(),
      ),
      ("source_target_mappings", markdown_mapping_list(config)),
    ],
  )
}

fn render_mappings(config: &ProjectConfig) -> io::Result<String> {
  render_json_template(TEMPLATE_MAPPINGS, config)
}

fn render_json_template(template: &str, config: &ProjectConfig) -> io::Result<String> {
  render_json(
    template,
    &[
      (
        "protocol_json",
        json_string(protocol_text(&config.sync.protocol))?,
      ),
      (
        "local_source_dir_json",
        json_string(&config.sync.local_source_dir)?,
      ),
      (
        "remote_runtime_dir_json",
        json_string(&config.sync.remote_runtime_dir)?,
      ),
      (
        "delete_propagation",
        bool_text(config.sync.delete_propagation).to_string(),
      ),
      (
        "auto_sync_on_change",
        bool_text(config.sync.auto_sync_on_change).to_string(),
      ),
      (
        "source_target_mappings_json",
        mapping_entries_json(config)?,
      ),
    ],
  )
}

fn render_json(template: &str, values: &[(&str, String)]) -> io::Result<String> {
  let rendered = render_template(template, values);
  serde_json::from_str::<serde_json::Value>(&rendered).map_err(io::Error::other)?;
  Ok(rendered)
}

fn mapping_entries_json(config: &ProjectConfig) -> io::Result<String> {
  let mut entries = Vec::new();
  for mapping in &config.mappings {
    let source = json_string(&mapping.local)?;
    let target = json_string(&mapping.remote)?;
    entries.push(format!("    {{ \"source\": {source}, \"target\": {target} }}"));
  }
  Ok(entries.join(",\n"))
}

fn json_string(value: &str) -> io::Result<String> {
  serde_json::to_string(value).map_err(io::Error::other)
}

fn render_template(template: &str, values: &[(&str, String)]) -> String {
  let mut rendered = template.to_string();
  for (key, value) in values {
    rendered = rendered.replace(&format!("{{{{{key}}}}}"), value);
  }
  rendered
}

fn markdown_mapping_list(config: &ProjectConfig) -> String {
  if config.mappings.is_empty() {
    return "- (none)".into();
  }
  let lines: Vec<String> = config
    .mappings
    .iter()
    .map(|mapping| format!("- {} -> {}", mapping.local, mapping.remote))
    .collect();
  lines.join("\n")
}

fn markdown_skill_list(enabled_skills: &[String]) -> String {
  if enabled_skills.is_empty() {
    return "- (none)".into();
  }
  let lines: Vec<String> = enabled_skills
    .iter()
    .map(|skill_name| format!("- {skill_name}"))
    .collect();
  lines.join("\n")
}

fn protocol_text(protocol: &SyncProtocol) -> &'static str {
  match protocol {
    SyncProtocol::Sftp => "sftp",
    SyncProtocol::Ftp => "ftp",
  }
}

fn bool_text(value: bool) -> &'static str {
  if value { "true" } else { "false" }
}

fn write_text(path: PathBuf, content: &str) -> io::Result<()> {
  fs::write(path, content)
}
