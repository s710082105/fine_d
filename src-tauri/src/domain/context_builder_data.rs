use super::project_config::{DbType, ProjectConfig};
use std::io;

fn db_type_label(db_type: &DbType) -> &'static str {
    match db_type {
        DbType::Mysql => "mysql",
        DbType::Postgresql => "postgresql",
        DbType::Oracle => "oracle",
        DbType::Sqlserver => "sqlserver",
    }
}

pub fn markdown_data_connections(config: &ProjectConfig) -> String {
    if config.data_connections.is_empty() {
        return "- (none)".into();
    }

    config
        .data_connections
        .iter()
        .map(|connection| {
            format!(
                "- name: {}\n  db_type: {}\n  host: {}\n  port: {}\n  database: {}\n  username: {}\n  password: {}",
                connection.connection_name,
                db_type_label(&connection.db_type),
                connection.host,
                connection.port,
                connection.database,
                connection.username,
                connection.password
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn data_connections_json(config: &ProjectConfig) -> io::Result<String> {
    serde_json::to_string_pretty(&config.data_connections).map_err(io::Error::other)
}
