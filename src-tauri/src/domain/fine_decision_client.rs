use crate::domain::fine_decision_encryption::build_sql_preview_transport;
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const LOGIN_PATH: &str = "/login";
const LIST_CONNECTIONS_PATH: &str = "/v10/config/connection/list/0";
const LIST_DATASETS_PATH: &str = "/v10/dataset";
const PREVIEW_EXISTING_PATH: &str = "/v10/dataset/preview/exist";
const PREVIEW_SQL_PATH: &str = "/v10/dataset/preview";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FineDecisionConfig {
    pub base_url: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesignerConnectionSummary {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesignerDatasetSummary {
    pub dataset_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PreviewDatasetRequest {
    pub dataset_name: String,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PreviewSqlRequest {
    pub connection_name: String,
    pub sql: String,
    pub row_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DatasetPreviewColumn {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DatasetPreviewResult {
    pub columns: Vec<DatasetPreviewColumn>,
    pub rows: Vec<Vec<Value>>,
}

#[derive(Debug, Clone)]
pub struct FineDecisionClient {
    client: Client,
    config: FineDecisionConfig,
}

impl FineDecisionClient {
    pub fn new(config: FineDecisionConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .cookie_store(true)
            .build()
            .expect("fine decision reqwest client");
        Self { client, config }
    }

    pub fn list_connections(&self) -> Result<Vec<DesignerConnectionSummary>, String> {
        let value = self.get_json(LIST_CONNECTIONS_PATH)?;
        let items = data_array(value)?;
        items.iter().map(parse_connection).collect()
    }

    pub fn list_datasets(&self) -> Result<Vec<DesignerDatasetSummary>, String> {
        let value = self.get_json(LIST_DATASETS_PATH)?;
        let items = data_array(value)?;
        items.iter().map(parse_dataset).collect()
    }

    pub fn preview_existing_dataset(
        &self,
        request: PreviewDatasetRequest,
    ) -> Result<DatasetPreviewResult, String> {
        let body = json!({
            "datasetName": request.dataset_name,
            "parameters": [],
            "needDesensitize": false
        });
        let path = format!("{PREVIEW_EXISTING_PATH}?rowCount={}", request.row_count);
        let value = self.post_json(path.as_str(), &body, HeaderMap::new())?;
        parse_preview_result(value)
    }

    pub fn preview_sql_dataset(
        &self,
        request: PreviewSqlRequest,
    ) -> Result<DatasetPreviewResult, String> {
        let landing_page = self.get_text("")?;
        let transport = build_sql_preview_transport(&landing_page, &request)?;
        let path = format!("{PREVIEW_SQL_PATH}?rowCount={}", request.row_count);
        let value = self.post_json(path.as_str(), &transport.body, transport.headers)?;
        parse_preview_result(value)
    }

    fn get_json(&self, path: &str) -> Result<Value, String> {
        let response = self
            .client
            .get(self.url(path))
            .headers(self.auth_headers()?)
            .send()
            .map_err(|error| format!("request to FineReport failed: {error}"))?;
        parse_json_response(response)
    }

    fn get_text(&self, path: &str) -> Result<String, String> {
        self.client
            .get(self.url(path))
            .send()
            .map_err(|error| format!("request to FineReport failed: {error}"))?
            .text()
            .map_err(|error| format!("failed to read FineReport response body: {error}"))
    }

    fn post_json(
        &self,
        path: &str,
        body: &Value,
        extra_headers: HeaderMap,
    ) -> Result<Value, String> {
        let mut headers = self.auth_headers()?;
        headers.extend(extra_headers);
        let response = self
            .client
            .post(self.url(path))
            .headers(headers)
            .json(body)
            .send()
            .map_err(|error| format!("request to FineReport failed: {error}"))?;
        parse_json_response(response)
    }

    fn auth_headers(&self) -> Result<reqwest::header::HeaderMap, String> {
        let token = self.access_token()?;
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, "application/json".parse().unwrap());
        headers.insert(ACCEPT, "application/json".parse().unwrap());
        headers.insert(
            AUTHORIZATION,
            format!("Bearer {token}")
                .parse::<reqwest::header::HeaderValue>()
                .map_err(|error| error.to_string())?,
        );
        Ok(headers)
    }

    fn access_token(&self) -> Result<String, String> {
        let login = json!({
            "username": self.config.username,
            "password": self.config.password,
            "validity": -1,
            "sliderToken": "",
            "origin": "",
            "encrypted": false
        });
        let response = self
            .client
            .post(self.url(LOGIN_PATH))
            .header(CONTENT_TYPE, "application/json")
            .header(ACCEPT, "application/json")
            .json(&login)
            .send()
            .map_err(|error| format!("FineReport login failed: {error}"))?;
        let value = parse_json_response(response)?;
        value
            .get("data")
            .and_then(|item| item.get("accessToken"))
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| format!("missing accessToken in FineReport login response: {value}"))
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", normalize_base_url(&self.config.base_url), path)
    }
}

fn normalize_base_url(base_url: &str) -> String {
    base_url.trim_end_matches('/').to_string()
}

fn data_array(value: Value) -> Result<Vec<Value>, String> {
    value
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .ok_or_else(|| format!("missing data array in FineReport response: {value}"))
}

fn parse_connection(value: &Value) -> Result<DesignerConnectionSummary, String> {
    let name = value
        .get("name")
        .or_else(|| value.get("connectionName"))
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing connection name in FineReport response item: {value}"))?;
    Ok(DesignerConnectionSummary { name: name.into() })
}

fn parse_dataset(value: &Value) -> Result<DesignerDatasetSummary, String> {
    let dataset_name = value
        .get("datasetName")
        .or_else(|| value.get("name"))
        .and_then(Value::as_str)
        .ok_or_else(|| format!("missing dataset name in FineReport response item: {value}"))?;
    Ok(DesignerDatasetSummary {
        dataset_name: dataset_name.into(),
    })
}

fn parse_preview_result(value: Value) -> Result<DatasetPreviewResult, String> {
    let data = value
        .get("data")
        .ok_or_else(|| format!("missing data block in FineReport preview response: {value}"))?;
    let columns = data
        .get("columns")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing columns in FineReport preview response: {value}"))?
        .iter()
        .map(parse_preview_column)
        .collect::<Result<Vec<_>, _>>()?;
    let rows = data
        .get("rows")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("missing rows in FineReport preview response: {value}"))?
        .iter()
        .map(parse_preview_row)
        .collect::<Result<Vec<_>, _>>()?;
    Ok(DatasetPreviewResult { columns, rows })
}

fn parse_preview_column(value: &Value) -> Result<DatasetPreviewColumn, String> {
    let name = value
        .get("name")
        .or_else(|| value.get("columnName"))
        .and_then(Value::as_str)
        .ok_or_else(|| {
            format!("missing preview column name in FineReport response item: {value}")
        })?;
    Ok(DatasetPreviewColumn { name: name.into() })
}

fn parse_preview_row(value: &Value) -> Result<Vec<Value>, String> {
    value
        .as_array()
        .cloned()
        .ok_or_else(|| format!("invalid preview row in FineReport response: {value}"))
}

fn parse_json_response(response: reqwest::blocking::Response) -> Result<Value, String> {
    let status = response.status();
    let text = response
        .text()
        .map_err(|error| format!("failed to read FineReport response body: {error}"))?;
    if !status.is_success() {
        return Err(format!("FineReport returned {status}: {text}"));
    }
    serde_json::from_str(&text).map_err(|error| {
        format!("failed to parse FineReport response as JSON: {error}; body: {text}")
    })
}
