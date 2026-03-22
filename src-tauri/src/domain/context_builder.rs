use super::context_builder_data::{data_connections_json, markdown_data_connections};
use super::project_config::{ProjectConfig, SyncProtocol};
use include_dir::{include_dir, Dir, DirEntry, File};
use std::fs;
use std::io;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

static EMBEDDED_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../embedded");

const BASE_AGENT_PATH: &str = "agents/base/AGENTS.md";
const TEMPLATE_PROJECT_CONTEXT_PATH: &str = "templates/project-context.md.hbs";
const TEMPLATE_PROJECT_RULES_PATH: &str = "templates/project-rules.md.hbs";
const TEMPLATE_MAPPINGS_PATH: &str = "templates/mappings.json.hbs";

pub fn build_runtime_context(
    context_dir: &Path,
    config: &ProjectConfig,
    enabled_skills: &[String],
) -> io::Result<()> {
    fs::create_dir_all(context_dir)?;
    write_text(
        context_dir.join("AGENTS.md"),
        embedded_text(BASE_AGENT_PATH)?,
    )?;
    let skills_dir = context_dir.join("skills");
    fs::create_dir_all(&skills_dir)?;
    copy_enabled_skills(&skills_dir, enabled_skills)?;
    write_text(
        context_dir.join("project-context.md"),
        &render_project_context(config, enabled_skills)?,
    )?;
    write_text(
        context_dir.join("project-rules.md"),
        &render_project_rules(config)?,
    )?;
    write_text(context_dir.join("mappings.json"), &render_mappings(config)?)?;
    Ok(())
}

fn embedded_text(path: &str) -> io::Result<&'static str> {
    EMBEDDED_DIR
        .get_file(path)
        .and_then(File::contents_utf8)
        .ok_or_else(|| {
            io::Error::new(
                ErrorKind::NotFound,
                format!("missing embedded file: {path}"),
            )
        })
}

fn copy_enabled_skills(skills_dir: &Path, enabled_skills: &[String]) -> io::Result<()> {
    for skill_name in enabled_skills {
        let skill_dir = EMBEDDED_DIR
            .get_dir(format!("skills/{skill_name}"))
            .ok_or_else(|| {
                io::Error::new(
                    ErrorKind::InvalidInput,
                    format!("unsupported skill: {skill_name}"),
                )
            })?;
        write_embedded_dir(skill_dir, &skills_dir.join(skill_name))?;
    }
    Ok(())
}

fn write_embedded_dir(dir: &Dir<'_>, destination: &Path) -> io::Result<()> {
    fs::create_dir_all(destination)?;
    for entry in dir.entries() {
        match entry {
            DirEntry::Dir(child) => {
                write_embedded_dir(child, &destination.join(child.path().file_name().unwrap()))?
            }
            DirEntry::File(file) => {
                write_embedded_file(file, &destination.join(file.path().file_name().unwrap()))?
            }
        }
    }
    Ok(())
}

fn write_embedded_file(file: &File<'_>, destination: &Path) -> io::Result<()> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(destination, file.contents())
}

fn render_project_context(config: &ProjectConfig, enabled_skills: &[String]) -> io::Result<String> {
    let local_source_dir = config.local_source_dir().display().to_string();
    let preview_url = preview_review_url(&config.preview.url);
    render_text_template(
        embedded_text(TEMPLATE_PROJECT_CONTEXT_PATH)?,
        &[
            ("workspace_name", config.workspace.name.clone()),
            ("workspace_root_dir", config.workspace.root_dir.clone()),
            ("preview_url", preview_url.clone()),
            ("preview_account", config.preview.account.clone()),
            ("preview_password", config.preview.password.clone()),
            ("codex_api_key", config.ai.api_key.clone()),
            ("protocol", protocol_text(&config.sync.protocol).into()),
            ("designer_root", config.sync.designer_root.clone()),
            ("local_source_dir", local_source_dir),
            ("remote_runtime_dir", config.sync.remote_runtime_dir.clone()),
            (
                "style_instructions",
                markdown_optional_text(&config.style.instructions),
            ),
            ("enabled_skills", markdown_skill_list(enabled_skills)),
            ("data_connections", markdown_data_connections(config)),
            ("source_target_mappings", markdown_mapping_list(config)),
        ],
    )
}

fn render_project_rules(config: &ProjectConfig) -> io::Result<String> {
    let local_source_dir = config.local_source_dir().display().to_string();
    let preview_url = preview_review_url(&config.preview.url);
    render_text_template(
        embedded_text(TEMPLATE_PROJECT_RULES_PATH)?,
        &[
            ("protocol", protocol_text(&config.sync.protocol).into()),
            ("designer_root", config.sync.designer_root.clone()),
            ("local_source_dir", local_source_dir),
            ("remote_runtime_dir", config.sync.remote_runtime_dir.clone()),
            ("preview_url", preview_url),
            ("preview_account", config.preview.account.clone()),
            ("preview_password", config.preview.password.clone()),
            ("codex_api_key", config.ai.api_key.clone()),
            (
                "style_instructions",
                markdown_optional_text(&config.style.instructions),
            ),
            (
                "delete_propagation",
                bool_text(config.sync.delete_propagation).into(),
            ),
            (
                "auto_sync_on_change",
                bool_text(config.sync.auto_sync_on_change).into(),
            ),
            ("data_connections", markdown_data_connections(config)),
            ("source_target_mappings", markdown_mapping_list(config)),
        ],
    )
}

fn render_mappings(config: &ProjectConfig) -> io::Result<String> {
    let local_source_dir = config.local_source_dir().display().to_string();
    let preview_url = preview_review_url(&config.preview.url);
    render_json_template(
        embedded_text(TEMPLATE_MAPPINGS_PATH)?,
        &[
            (
                "protocol_json",
                json_string(protocol_text(&config.sync.protocol))?,
            ),
            (
                "designer_root_json",
                json_string(&config.sync.designer_root)?,
            ),
            ("local_source_dir_json", json_string(&local_source_dir)?),
            (
                "remote_runtime_dir_json",
                json_string(&config.sync.remote_runtime_dir)?,
            ),
            ("preview_url_json", json_string(&preview_url)?),
            (
                "preview_account_json",
                json_string(&config.preview.account)?,
            ),
            (
                "preview_password_json",
                json_string(&config.preview.password)?,
            ),
            (
                "style_instructions_json",
                json_string(&config.style.instructions)?,
            ),
            ("codex_api_key_json", json_string(&config.ai.api_key)?),
            (
                "delete_propagation",
                bool_text(config.sync.delete_propagation).into(),
            ),
            (
                "auto_sync_on_change",
                bool_text(config.sync.auto_sync_on_change).into(),
            ),
            ("data_connections_json", data_connections_json(config)?),
            ("source_target_mappings_json", mapping_entries_json(config)?),
        ],
    )
}

fn render_text_template(template: &str, values: &[(&str, String)]) -> io::Result<String> {
    Ok(render_template(template, values))
}

fn render_json_template(template: &str, values: &[(&str, String)]) -> io::Result<String> {
    let rendered = render_template(template, values);
    serde_json::from_str::<serde_json::Value>(&rendered).map_err(io::Error::other)?;
    Ok(rendered)
}

fn mapping_entries_json(config: &ProjectConfig) -> io::Result<String> {
    let mut entries = Vec::new();
    for mapping in &config.mappings {
        let source = json_string(&mapping.local)?;
        let target = json_string(&mapping.remote)?;
        entries.push(format!(
            "    {{ \"source\": {source}, \"target\": {target} }}"
        ));
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
    config
        .mappings
        .iter()
        .map(|mapping| format!("- {} -> {}", mapping.local, mapping.remote))
        .collect::<Vec<_>>()
        .join("\n")
}

fn markdown_skill_list(enabled_skills: &[String]) -> String {
    if enabled_skills.is_empty() {
        return "- (none)".into();
    }
    enabled_skills
        .iter()
        .map(|skill_name| format!("- {skill_name}"))
        .collect::<Vec<_>>()
        .join("\n")
}

fn markdown_optional_text(value: &str) -> String {
    if value.trim().is_empty() {
        return "- (none)".into();
    }
    value.into()
}

fn preview_review_url(url: &str) -> String {
    let trimmed = url.trim();
    let (body, fragment) = split_once(trimmed, '#');
    let (base, query) = split_once(body, '?');
    let mut pairs = query
        .unwrap_or("")
        .split('&')
        .filter(|segment| !segment.is_empty())
        .filter(|segment| !segment.starts_with("op="))
        .map(str::to_string)
        .collect::<Vec<_>>();
    pairs.push("op=view".into());
    let mut normalized = format!("{base}?{}", pairs.join("&"));
    if let Some(fragment) = fragment {
        normalized.push('#');
        normalized.push_str(fragment);
    }
    normalized
}

fn split_once<'a>(value: &'a str, separator: char) -> (&'a str, Option<&'a str>) {
    match value.split_once(separator) {
        Some((left, right)) => (left, Some(right)),
        None => (value, None),
    }
}

fn protocol_text(protocol: &SyncProtocol) -> &'static str {
    match protocol {
        SyncProtocol::Fine => "fine",
    }
}

fn bool_text(value: bool) -> &'static str {
    if value {
        "true"
    } else {
        "false"
    }
}

fn write_text(path: PathBuf, content: &str) -> io::Result<()> {
    fs::write(path, content)
}
