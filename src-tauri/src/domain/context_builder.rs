use super::project_config::{PreviewMode, ProjectConfig, SyncProtocol};
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
    render_text_template(
        embedded_text(TEMPLATE_PROJECT_CONTEXT_PATH)?,
        &[
            ("workspace_name", config.workspace.name.clone()),
            ("workspace_root_dir", config.workspace.root_dir.clone()),
            ("preview_url", config.preview.url.clone()),
            (
                "preview_mode",
                preview_mode_text(&config.preview.mode).into(),
            ),
            ("protocol", protocol_text(&config.sync.protocol).into()),
            ("host", config.sync.host.clone()),
            ("port", config.sync.port.to_string()),
            ("username", config.sync.username.clone()),
            ("local_source_dir", local_source_dir),
            ("remote_runtime_dir", config.sync.remote_runtime_dir.clone()),
            ("font_family", config.style.font_family.clone()),
            ("font_size", config.style.font_size.to_string()),
            ("line_height", config.style.line_height.to_string()),
            ("column_width", config.style.column_width.to_string()),
            (
                "header_font_family",
                config.style.header_font_family.clone(),
            ),
            (
                "header_font_size",
                config.style.header_font_size.to_string(),
            ),
            ("number_format", config.style.number_format.clone()),
            ("enabled_skills", markdown_skill_list(enabled_skills)),
            ("source_target_mappings", markdown_mapping_list(config)),
        ],
    )
}

fn render_project_rules(config: &ProjectConfig) -> io::Result<String> {
    let local_source_dir = config.local_source_dir().display().to_string();
    render_text_template(
        embedded_text(TEMPLATE_PROJECT_RULES_PATH)?,
        &[
            ("protocol", protocol_text(&config.sync.protocol).into()),
            ("host", config.sync.host.clone()),
            ("port", config.sync.port.to_string()),
            ("username", config.sync.username.clone()),
            ("local_source_dir", local_source_dir),
            ("remote_runtime_dir", config.sync.remote_runtime_dir.clone()),
            ("preview_url", config.preview.url.clone()),
            (
                "preview_mode",
                preview_mode_text(&config.preview.mode).into(),
            ),
            (
                "delete_propagation",
                bool_text(config.sync.delete_propagation).into(),
            ),
            (
                "auto_sync_on_change",
                bool_text(config.sync.auto_sync_on_change).into(),
            ),
            ("source_target_mappings", markdown_mapping_list(config)),
        ],
    )
}

fn render_mappings(config: &ProjectConfig) -> io::Result<String> {
    let local_source_dir = config.local_source_dir().display().to_string();
    render_json_template(
        embedded_text(TEMPLATE_MAPPINGS_PATH)?,
        &[
            (
                "protocol_json",
                json_string(protocol_text(&config.sync.protocol))?,
            ),
            ("host_json", json_string(&config.sync.host)?),
            ("port", config.sync.port.to_string()),
            ("username_json", json_string(&config.sync.username)?),
            ("local_source_dir_json", json_string(&local_source_dir)?),
            (
                "remote_runtime_dir_json",
                json_string(&config.sync.remote_runtime_dir)?,
            ),
            ("preview_url_json", json_string(&config.preview.url)?),
            (
                "preview_mode_json",
                json_string(preview_mode_text(&config.preview.mode))?,
            ),
            ("font_family_json", json_string(&config.style.font_family)?),
            ("font_size", config.style.font_size.to_string()),
            ("line_height", config.style.line_height.to_string()),
            ("column_width", config.style.column_width.to_string()),
            (
                "header_font_family_json",
                json_string(&config.style.header_font_family)?,
            ),
            (
                "header_font_size",
                config.style.header_font_size.to_string(),
            ),
            (
                "number_format_json",
                json_string(&config.style.number_format)?,
            ),
            (
                "delete_propagation",
                bool_text(config.sync.delete_propagation).into(),
            ),
            (
                "auto_sync_on_change",
                bool_text(config.sync.auto_sync_on_change).into(),
            ),
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

fn protocol_text(protocol: &SyncProtocol) -> &'static str {
    match protocol {
        SyncProtocol::Sftp => "sftp",
        SyncProtocol::Ftp => "ftp",
        SyncProtocol::Local => "local",
    }
}

fn preview_mode_text(mode: &PreviewMode) -> &'static str {
    match mode {
        PreviewMode::Embedded => "embedded",
        PreviewMode::External => "external",
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
