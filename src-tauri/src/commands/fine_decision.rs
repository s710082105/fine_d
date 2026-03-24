use crate::commands::project_config::load_project_config_from_project_dir;
use crate::domain::fine_decision_client::{
    DatasetPreviewResult, DesignerConnectionSummary, DesignerDatasetSummary, FineDecisionClient,
    FineDecisionConfig, PreviewDatasetRequest, PreviewSqlRequest,
};
use serde::Deserialize;
use std::env;
use std::ffi::OsString;
use std::path::Path;
use tauri::AppHandle;

const LIST_CONNECTIONS_FLAG: &str = "--project-data-list-connections";
const LIST_DATASETS_FLAG: &str = "--project-data-list-datasets";
const PREVIEW_DATASET_FLAG: &str = "--project-data-preview-dataset";
const PREVIEW_SQL_FLAG: &str = "--project-data-preview-sql";
const DEFAULT_ROW_COUNT: usize = 10;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FineDecisionRequest {
    pub url: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewExistingDatasetCommand {
    pub url: String,
    pub username: String,
    pub password: String,
    pub dataset_name: String,
    pub row_count: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSqlDatasetCommand {
    pub url: String,
    pub username: String,
    pub password: String,
    pub connection_name: String,
    pub sql: String,
    pub row_count: Option<usize>,
}

#[tauri::command]
pub fn list_designer_connections(
    _app: AppHandle,
    request: FineDecisionRequest,
) -> Result<Vec<DesignerConnectionSummary>, String> {
    client_from_request(&request).list_connections()
}

#[tauri::command]
pub fn list_designer_datasets(
    _app: AppHandle,
    request: FineDecisionRequest,
) -> Result<Vec<DesignerDatasetSummary>, String> {
    client_from_request(&request).list_datasets()
}

#[tauri::command]
pub fn preview_existing_designer_dataset(
    _app: AppHandle,
    request: PreviewExistingDatasetCommand,
) -> Result<DatasetPreviewResult, String> {
    client_from_request(&request.into_base()).preview_existing_dataset(PreviewDatasetRequest {
        dataset_name: request.dataset_name,
        row_count: request.row_count.unwrap_or(DEFAULT_ROW_COUNT),
    })
}

#[tauri::command]
pub fn preview_sql_designer_dataset(
    _app: AppHandle,
    request: PreviewSqlDatasetCommand,
) -> Result<DatasetPreviewResult, String> {
    client_from_request(&request.into_base()).preview_sql_dataset(PreviewSqlRequest {
        connection_name: request.connection_name,
        sql: request.sql,
        row_count: request.row_count.unwrap_or(DEFAULT_ROW_COUNT),
    })
}

pub fn try_run_cli() -> Result<bool, String> {
    let args: Vec<OsString> = env::args_os().skip(1).collect();
    match args.first().and_then(|value| value.to_str()) {
        Some(LIST_CONNECTIONS_FLAG) => {
            let client = client_from_project(args.get(1))?;
            print_json(&client.list_connections()?)?;
            Ok(true)
        }
        Some(LIST_DATASETS_FLAG) => {
            let client = client_from_project(args.get(1))?;
            print_json(&client.list_datasets()?)?;
            Ok(true)
        }
        Some(PREVIEW_DATASET_FLAG) => {
            let client = client_from_project(args.get(1))?;
            let dataset_name = required_arg(&args, 2, "dataset name")?;
            let result = client.preview_existing_dataset(PreviewDatasetRequest {
                dataset_name,
                row_count: DEFAULT_ROW_COUNT,
            })?;
            print_json(&result)?;
            Ok(true)
        }
        Some(PREVIEW_SQL_FLAG) => {
            let client = client_from_project(args.get(1))?;
            let connection_name = required_arg(&args, 2, "connection name")?;
            let sql = required_arg(&args, 3, "sql")?;
            let result = client.preview_sql_dataset(PreviewSqlRequest {
                connection_name,
                sql,
                row_count: DEFAULT_ROW_COUNT,
            })?;
            print_json(&result)?;
            Ok(true)
        }
        _ => Ok(false),
    }
}

fn client_from_project(project_dir: Option<&OsString>) -> Result<FineDecisionClient, String> {
    let path = Path::new(required_os_arg(project_dir, "project dir")?);
    let response = load_project_config_from_project_dir(path)?;
    Ok(client_from_request(&FineDecisionRequest {
        url: response.config.preview.url,
        username: response.config.preview.account,
        password: response.config.preview.password,
    }))
}

fn client_from_request(request: &FineDecisionRequest) -> FineDecisionClient {
    FineDecisionClient::new(FineDecisionConfig {
        base_url: request.url.trim().into(),
        username: request.username.clone(),
        password: request.password.clone(),
    })
}

fn required_arg(args: &[OsString], index: usize, label: &str) -> Result<String, String> {
    args.get(index)
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .map(str::to_owned)
        .ok_or_else(|| format!("missing {label}"))
}

fn required_os_arg<'a>(value: Option<&'a OsString>, label: &str) -> Result<&'a str, String> {
    value
        .and_then(|item| item.to_str())
        .filter(|item| !item.trim().is_empty())
        .ok_or_else(|| format!("missing {label}"))
}

fn print_json<T: serde::Serialize>(value: &T) -> Result<(), String> {
    println!(
        "{}",
        serde_json::to_string(value).map_err(|error| error.to_string())?
    );
    Ok(())
}

impl PreviewExistingDatasetCommand {
    fn into_base(&self) -> FineDecisionRequest {
        FineDecisionRequest {
            url: self.url.clone(),
            username: self.username.clone(),
            password: self.password.clone(),
        }
    }
}

impl PreviewSqlDatasetCommand {
    fn into_base(&self) -> FineDecisionRequest {
        FineDecisionRequest {
            url: self.url.clone(),
            username: self.username.clone(),
            password: self.password.clone(),
        }
    }
}
