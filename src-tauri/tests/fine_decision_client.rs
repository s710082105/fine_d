use finereport_tauri_shell_lib::domain::fine_decision_client::{
    DesignerConnectionSummary, FineDecisionClient, FineDecisionConfig, PreviewDatasetRequest,
    PreviewSqlRequest,
};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener};
use std::sync::{Arc, Mutex};
use std::thread;

fn start_mock_server(requests: Arc<Mutex<Vec<String>>>) -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
    let address = listener.local_addr().expect("read local addr");
    thread::spawn(move || {
        for stream in listener.incoming() {
            let mut stream = stream.expect("accept stream");
            let mut buffer = [0_u8; 8192];
            let size = stream.read(&mut buffer).expect("read request");
            let request = String::from_utf8_lossy(&buffer[..size]).to_string();
            requests
                .lock()
                .expect("record request")
                .push(request.clone());
            let (status_line, body) = response_for(&request);
            let payload = format!(
                "{status_line}\r\ncontent-type: {}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                content_type_for(&body),
                body.len()
            );
            stream
                .write_all(payload.as_bytes())
                .expect("write response");
        }
    });
    address
}

fn content_type_for(body: &str) -> &'static str {
    if body.starts_with("<!DOCTYPE html>") {
        "text/html; charset=utf-8"
    } else {
        "application/json"
    }
}

fn response_for(request: &str) -> (&'static str, String) {
    let request_lower = request.to_ascii_lowercase();
    if request.starts_with("GET /webroot/decision ") {
        return (
            "HTTP/1.1 200 OK",
            "<!DOCTYPE html><script>Dec.system = JSON.parse('{\\\"encryptionType\\\":0,\\\"transmissionEncryption\\\":2,\\\"encryptionKey\\\":\\\"MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANPDl9Pe4fz2PjPXbUrbNVQAS/jm9uuR+K7Mn/N+gddfRPhaLQjNNwFJVDDG1VTnw6sRjhcO2vHuDs+FjqOG/YECAwEAAQ==\\\"}');</script>".into(),
        );
    }
    if request.starts_with("POST /webroot/decision/login ") {
        return (
            "HTTP/1.1 200 OK",
            r#"{"data":{"accessToken":"token-1"}}"#.into(),
        );
    }
    if request.starts_with("GET /webroot/decision/v10/config/connection/list/0 ") {
        return (
            "HTTP/1.1 200 OK",
            r#"{"data":[{"name":"test"},{"name":"FRDemo"}]}"#.into(),
        );
    }
    if request.starts_with("GET /webroot/decision/v10/dataset ") {
        return (
            "HTTP/1.1 200 OK",
            r#"{"data":[{"datasetName":"用户信息表"},{"datasetName":"员工信息表"}]}"#.into(),
        );
    }
    if request.starts_with("POST /webroot/decision/v10/dataset/preview/exist?rowCount=10 ") {
        return (
            "HTTP/1.1 200 OK",
            r#"{"data":{"columns":[{"name":"id"},{"name":"name"}],"rows":[[1,"Alice"]]}}"#.into(),
        );
    }
    if request.starts_with("POST /webroot/decision/v10/dataset/preview?rowCount=10 ") {
        if preview_sql_request_is_encrypted(request, &request_lower) {
            return (
                "HTTP/1.1 200 OK",
                r#"{"data":{"columns":[{"name":"id"},{"name":"amount"}],"rows":[[1,88.5]]}}"#
                    .into(),
            );
        }
        return (
            "HTTP/1.1 200 OK",
            "<!DOCTYPE html><div>preview failed</div>".into(),
        );
    }
    ("HTTP/1.1 404 Not Found", r#"{"error":"not found"}"#.into())
}

fn preview_sql_request_is_encrypted(request: &str, request_lower: &str) -> bool {
    if !request_lower.contains("transencryptlevel: 1") {
        return false;
    }
    let Some(body) = request.split("\r\n\r\n").nth(1) else {
        return false;
    };
    let Ok(payload) = serde_json::from_str::<serde_json::Value>(body) else {
        return false;
    };
    let Some(dataset_data) = payload
        .get("datasetData")
        .and_then(serde_json::Value::as_str)
    else {
        return false;
    };
    let Ok(dataset) = serde_json::from_str::<serde_json::Value>(dataset_data) else {
        return false;
    };
    payload.get("datasetType") == Some(&serde_json::json!("sql"))
        && dataset.get("database") == Some(&serde_json::json!("test"))
        && dataset
            .get("query")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|query| query != "select 1 as id, 88.5 as amount")
}

fn test_client(requests: Arc<Mutex<Vec<String>>>) -> FineDecisionClient {
    let address = start_mock_server(requests);
    FineDecisionClient::new(FineDecisionConfig {
        base_url: format!("http://{address}/webroot/decision"),
        username: "admin".into(),
        password: "admin".into(),
    })
}

#[test]
fn fine_decision_client_lists_connections_and_datasets() {
    let client = test_client(Arc::new(Mutex::new(Vec::new())));

    let connections = client
        .list_connections()
        .expect("list designer connections");
    let datasets = client.list_datasets().expect("list datasets");

    assert_eq!(
        connections,
        vec![
            DesignerConnectionSummary {
                name: "test".into()
            },
            DesignerConnectionSummary {
                name: "FRDemo".into()
            }
        ]
    );
    assert_eq!(datasets.len(), 2);
    assert_eq!(datasets[0].dataset_name, "用户信息表");
}

#[test]
fn fine_decision_client_previews_existing_dataset_and_sql_dataset() {
    let requests = Arc::new(Mutex::new(Vec::new()));
    let client = test_client(requests.clone());

    let existing = client
        .preview_existing_dataset(PreviewDatasetRequest {
            dataset_name: "用户信息表".into(),
            row_count: 10,
        })
        .expect("preview existing dataset");
    let sql = client
        .preview_sql_dataset(PreviewSqlRequest {
            connection_name: "test".into(),
            sql: "select 1 as id, 88.5 as amount".into(),
            row_count: 10,
        })
        .expect("preview sql dataset");

    assert_eq!(existing.columns[0].name, "id");
    assert_eq!(existing.rows[0][1], serde_json::json!("Alice"));
    assert_eq!(sql.columns[1].name, "amount");
    assert_eq!(sql.rows[0][1], serde_json::json!(88.5));
    assert!(
        requests
            .lock()
            .expect("read requests")
            .iter()
            .any(|request| request.starts_with("GET /webroot/decision ")),
        "preview sql should load Dec.system before encrypting request body"
    );
}
