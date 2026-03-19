use super::project_config::ProjectConfig;
use std::io;

pub fn markdown_data_connections(config: &ProjectConfig) -> String {
    if config.data_connections.is_empty() {
        return "- (none)".into();
    }

    config
        .data_connections
        .iter()
        .map(|connection| {
            format!(
                "- name: {}\n  dsn: {}\n  username: {}\n  password: {}",
                connection.connection_name, connection.dsn, connection.username, connection.password
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn data_connections_json(config: &ProjectConfig) -> io::Result<String> {
    serde_json::to_string_pretty(&config.data_connections).map_err(io::Error::other)
}
