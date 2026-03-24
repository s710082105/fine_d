use crate::domain::fine_decision_client::PreviewSqlRequest;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use rand::rngs::OsRng;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use rsa::pkcs1::DecodeRsaPublicKey;
use rsa::pkcs1v15::Pkcs1v15Encrypt;
use rsa::pkcs8::DecodePublicKey;
use rsa::RsaPublicKey;
use serde::Deserialize;
use serde_json::json;

const RSA_ENCRYPTION_TYPE: u8 = 0;
const SM2_ENCRYPTION_TYPE: u8 = 1;
const RSA_CHUNK_SIZE: usize = 50;
const RSA_CONNECTOR: &str = "---";
const SQL_PREVIEW_DATASET_NAME: &str = "tmp_preview";
const SYSTEM_MARKER: &str = "Dec.system = JSON.parse('";
const SYSTEM_SUFFIX: &str = "')";
const TRANS_ENCRYPT_LEVEL: HeaderName = HeaderName::from_static("transencryptlevel");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FineDecisionSystemConfig {
    encryption_type: u8,
    encryption_key: Option<String>,
}

pub struct SqlPreviewTransport {
    pub body: serde_json::Value,
    pub headers: HeaderMap,
}

pub fn build_sql_preview_transport(
    landing_page: &str,
    request: &PreviewSqlRequest,
) -> Result<SqlPreviewTransport, String> {
    let system = parse_system_config(landing_page)?;
    match system.encryption_type {
        RSA_ENCRYPTION_TYPE => rsa_transport(&system, request),
        SM2_ENCRYPTION_TYPE => Err("FineReport SQL 预览当前使用 SM2 加密，尚未实现".into()),
        value => Err(format!(
            "FineReport SQL 预览使用了不支持的 encryptionType={value}"
        )),
    }
}

fn rsa_transport(
    system: &FineDecisionSystemConfig,
    request: &PreviewSqlRequest,
) -> Result<SqlPreviewTransport, String> {
    let public_key = parse_public_key(system.encryption_key.as_deref())?;
    let query = encrypt_rsa_chunks(&public_key, &request.sql)?;
    let dataset_data = json!({
        "database": request.connection_name,
        "query": query,
        "parameters": []
    });
    let body = json!({
        "datasetType": "sql",
        "datasetName": SQL_PREVIEW_DATASET_NAME,
        "datasetData": dataset_data.to_string(),
        "parameters": []
    });
    let mut headers = HeaderMap::new();
    headers.insert(TRANS_ENCRYPT_LEVEL, HeaderValue::from_static("1"));
    Ok(SqlPreviewTransport { body, headers })
}

fn parse_system_config(landing_page: &str) -> Result<FineDecisionSystemConfig, String> {
    let escaped = extract_system_json(landing_page)?;
    let decoded = serde_json::from_str::<String>(&format!("\"{escaped}\""))
        .map_err(|error| format!("failed to decode FineReport Dec.system payload: {error}"))?;
    serde_json::from_str::<FineDecisionSystemConfig>(&decoded)
        .map_err(|error| format!("failed to parse FineReport Dec.system JSON: {error}"))
}

fn extract_system_json(landing_page: &str) -> Result<&str, String> {
    let start = landing_page
        .find(SYSTEM_MARKER)
        .ok_or_else(|| "missing Dec.system bootstrap on FineReport landing page".to_string())?
        + SYSTEM_MARKER.len();
    let tail = &landing_page[start..];
    let end = tail.find(SYSTEM_SUFFIX).ok_or_else(|| {
        "missing Dec.system closing marker on FineReport landing page".to_string()
    })?;
    Ok(&tail[..end])
}

fn parse_public_key(raw_key: Option<&str>) -> Result<RsaPublicKey, String> {
    let body = extract_public_key_body(raw_key)?;
    parse_spki_public_key(&body).or_else(|spki_error| {
        parse_pkcs1_public_key(&body).map_err(|pkcs1_error| {
            format!(
                "failed to parse FineReport RSA public key: spki={spki_error}; pkcs1={pkcs1_error}"
            )
        })
    })
}

fn extract_public_key_body(raw_key: Option<&str>) -> Result<String, String> {
    let value = raw_key
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .ok_or_else(|| "missing FineReport encryptionKey on landing page".to_string())?;
    let body = if value.contains("BEGIN ") {
        value
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty() && !line.starts_with("-----"))
            .collect::<String>()
    } else {
        value.chars().filter(|ch| !ch.is_whitespace()).collect()
    };
    if body.is_empty() {
        return Err("missing RSA public key body in FineReport encryptionKey".into());
    }
    Ok(body)
}

fn parse_spki_public_key(body: &str) -> Result<RsaPublicKey, rsa::pkcs8::spki::Error> {
    RsaPublicKey::from_public_key_pem(&wrap_pem_body(body, "PUBLIC KEY"))
}

fn parse_pkcs1_public_key(body: &str) -> Result<RsaPublicKey, rsa::pkcs1::Error> {
    RsaPublicKey::from_pkcs1_pem(&wrap_pem_body(body, "RSA PUBLIC KEY"))
}

fn wrap_pem_body(body: &str, label: &str) -> String {
    let lines = split_chunks(body, 64).join("\n");
    format!("-----BEGIN {label}-----\n{lines}\n-----END {label}-----")
}

fn encrypt_rsa_chunks(public_key: &RsaPublicKey, sql: &str) -> Result<String, String> {
    let mut rng = OsRng;
    split_chunks(sql, RSA_CHUNK_SIZE)
        .into_iter()
        .map(|chunk| {
            public_key
                .encrypt(&mut rng, Pkcs1v15Encrypt, chunk.as_bytes())
                .map(|bytes| BASE64.encode(bytes))
                .map_err(|error| format!("failed to encrypt FineReport SQL chunk: {error}"))
        })
        .collect::<Result<Vec<_>, _>>()
        .map(|chunks| chunks.join(RSA_CONNECTOR))
}

fn split_chunks(value: &str, chunk_size: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut current_len = 0;
    for ch in value.chars() {
        if current_len == chunk_size {
            chunks.push(current);
            current = String::new();
            current_len = 0;
        }
        current.push(ch);
        current_len += 1;
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

#[cfg(test)]
mod tests {
    use super::{parse_public_key, parse_system_config};

    const LANDING_PAGE: &str = "<!DOCTYPE html><script>Dec.system = JSON.parse('{\\\"encryptionType\\\":0,\\\"transmissionEncryption\\\":2,\\\"encryptionKey\\\":\\\"MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANPDl9Pe4fz2PjPXbUrbNVQAS/jm9uuR+K7Mn/N+gddfRPhaLQjNNwFJVDDG1VTnw6sRjhcO2vHuDs+FjqOG/YECAwEAAQ==\\\"}');</script>";

    #[test]
    fn parses_dec_system_payload_from_landing_page() {
        let system = parse_system_config(LANDING_PAGE).expect("parse system config");
        assert_eq!(system.encryption_type, 0);
        assert_eq!(
            system.encryption_key.as_deref(),
            Some("MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANPDl9Pe4fz2PjPXbUrbNVQAS/jm9uuR+K7Mn/N+gddfRPhaLQjNNwFJVDDG1VTnw6sRjhcO2vHuDs+FjqOG/YECAwEAAQ==")
        );
    }

    #[test]
    fn parses_rsa_public_key_from_landing_page_body() {
        parse_public_key(Some("MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANPDl9Pe4fz2PjPXbUrbNVQAS/jm9uuR+K7Mn/N+gddfRPhaLQjNNwFJVDDG1VTnw6sRjhcO2vHuDs+FjqOG/YECAwEAAQ=="))
            .expect("parse rsa public key");
    }

    #[test]
    fn parses_rsa_public_key_when_landing_page_body_contains_crlf() {
        parse_public_key(Some(
            "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAhOP/zdEfz4dqJ33vU7Z57FGzw/fDbqck\r\n1kI95QQirZUpGIlcfNVRnCjtTH7+BLz+XifgVEimvd5FH0BhlfcVRLyxYaSHuzXxIGlXLIbPtyWo\r\nMsRalqXAwFNJNbsbdZsBcfdpkX5aDg5YC8asB2wcStzuUPZFK5bvXnzwxOAKA1nJcpLdXYv/ptNQ\r\nROCcdfcmgpBu8q48jPMaGcl1cEp5Tib+3dc30/R4TUvNRn18h3zxfYEPOM8MKX3tSB01YyEDjBos\r\nllH03R5DF6/Jsdp50Ax3s+QU++bZicldsUCpckoe7O/QMt1aTpK2VC4kSEem2nXxWnhwnhkFc7lI\r\nk1+3uQIDAQAB",
        ))
        .expect("parse rsa public key with crlf");
    }
}
