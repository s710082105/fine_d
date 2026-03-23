use super::fine_remote_bridge_runtime::{prepare_bridge_runtime, FineRemoteBridgeRuntime};
use super::project_config::FineRemoteProfile;
use super::system_runtime::hide_window;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::Deserialize;
use serde_json::Value;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const ENV_PYTHONPATH: &str = "PYTHONPATH";

#[derive(Debug, Clone, Deserialize)]
pub struct FineRemoteEntry {
    pub path: String,
    pub directory: bool,
    pub lock: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ListPayload {
    items: Vec<FineRemoteEntry>,
}

#[derive(Debug, Deserialize)]
struct ReadPayload {
    #[serde(rename = "contentBase64")]
    content_base64: String,
}

#[derive(Debug, Deserialize)]
struct DeletePayload {
    deleted: bool,
    existed: bool,
}

#[derive(Clone)]
pub struct FineRemoteBridge {
    python_command: String,
    runtime: FineRemoteBridgeRuntime,
}

impl FineRemoteBridge {
    pub fn detect() -> Result<Self, String> {
        Ok(Self {
            python_command: resolve_python_command()?,
            runtime: prepare_bridge_runtime()?,
        })
    }

    pub fn list_files(
        &self,
        profile: &FineRemoteProfile,
        path: &str,
    ) -> Result<Vec<FineRemoteEntry>, String> {
        let payload: ListPayload = self.invoke("list", profile, path, None)?;
        Ok(payload.items)
    }

    pub fn read_file(&self, profile: &FineRemoteProfile, path: &str) -> Result<Vec<u8>, String> {
        let payload: ReadPayload = self.invoke("read", profile, path, None)?;
        BASE64_STANDARD
            .decode(payload.content_base64)
            .map_err(|error| format!("failed to decode bridge payload: {error}"))
    }

    pub fn write_file(
        &self,
        profile: &FineRemoteProfile,
        path: &str,
        content: &[u8],
    ) -> Result<(), String> {
        let _: Value = self.invoke("write", profile, path, Some(content))?;
        Ok(())
    }

    pub fn delete_file(&self, profile: &FineRemoteProfile, path: &str) -> Result<(), String> {
        let payload: DeletePayload = self.invoke("delete", profile, path, None)?;
        if payload.deleted || !payload.existed {
            return Ok(());
        }
        Err(format!("remote file delete returned false: {path}"))
    }

    fn invoke<T: for<'de> Deserialize<'de>>(
        &self,
        command: &str,
        profile: &FineRemoteProfile,
        path: &str,
        input: Option<&[u8]>,
    ) -> Result<T, String> {
        let input_path = write_temp_input(input)?;
        let mut process = Command::new(&self.python_command);
        process
            .current_dir(&self.runtime.working_dir)
            .env(ENV_PYTHONPATH, &self.runtime.python_path)
            .args(["-m", "fine_remote.cli", command])
            .args(["--url", &profile.url])
            .args(["--username", &profile.username])
            .args(["--password", &profile.password])
            .args(["--fine-home", &profile.designer_root])
            .args(["--path", path]);
        hide_window(&mut process);
        if let Some(input_path) = input_path.as_ref() {
            process.args(["--input-file", &input_path.display().to_string()]);
        }
        let output = process
            .output()
            .map_err(|error| format!("failed to execute fine remote bridge: {error}"))?;
        if let Some(input_path) = input_path {
            let _ = fs::remove_file(input_path);
        }
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let raw = if !stderr.is_empty() { stderr } else { stdout };
            return Err(summarize_bridge_error(
                &profile.url,
                &profile.designer_root,
                &raw,
            ));
        }
        serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("failed to parse fine remote bridge response: {error}"))
    }
}

fn resolve_python_command() -> Result<String, String> {
    let candidates = if cfg!(target_os = "windows") {
        ["py", "python", "python3"]
    } else {
        ["python3", "python", "py"]
    };
    for candidate in candidates {
        if let Ok(output) = Command::new(candidate).arg("--version").output() {
            if output.status.success() {
                return Ok(candidate.to_string());
            }
        }
    }
    Err("python3/python/py 均不可用".into())
}

fn write_temp_input(input: Option<&[u8]>) -> Result<Option<PathBuf>, String> {
    let Some(input) = input else {
        return Ok(None);
    };
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to resolve time: {error}"))?
        .as_nanos();
    let path = env::temp_dir().join(format!("fine_remote_input_{timestamp}.bin"));
    fs::write(&path, input).map_err(|error| format!("failed to write temp input file: {error}"))?;
    Ok(Some(path))
}

fn summarize_bridge_error(url: &str, designer_root: &str, raw: &str) -> String {
    if raw.contains("No FineReport jars found under") {
        return format!(
            "本地设计器目录无效：`{designer_root}` 下未找到 FineReport jars，请重新选择安装目录。"
        );
    }
    if raw.contains("DiskSpaceFullException") || raw.contains("disk space is full") {
        return "远端磁盘空间不足，无法保存文件。请先清理 FineReport 服务器磁盘空间后再重试。"
            .into();
    }
    if raw.contains("Connection refused") || raw.contains("HttpHostConnectException") {
        return format!(
            "无法连接到 FineReport 服务：`{url}`。请确认预览地址可访问，并且目标 FineReport 服务已经启动。"
        );
    }
    if raw.contains("Authentication") || raw.contains("login") || raw.contains("token") {
        return "FineReport 登录失败，请检查预览账号、预览密码和预览地址是否正确。".into();
    }
    if raw.contains("sync.designer_root does not exist") {
        return format!("本地设计器目录不存在：`{designer_root}`。");
    }
    format!("远程设计连接失败：{raw}")
}

#[cfg(test)]
mod tests {
    use super::summarize_bridge_error;

    #[test]
    fn summarize_bridge_error_translates_connection_refused() {
        let message = summarize_bridge_error(
            "http://127.0.0.1:8075/webroot/decision",
            "/Applications/FineReport",
            "HttpHostConnectException: Connection refused",
        );

        assert!(message.contains("无法连接到 FineReport 服务"));
        assert!(message.contains("127.0.0.1:8075"));
    }

    #[test]
    fn summarize_bridge_error_translates_missing_jars() {
        let message = summarize_bridge_error(
            "http://demo",
            "/tmp/fine",
            "No FineReport jars found under /tmp/fine",
        );

        assert!(message.contains("本地设计器目录无效"));
        assert!(message.contains("/tmp/fine"));
    }

    #[test]
    fn summarize_bridge_error_translates_disk_space_full() {
        let message = summarize_bridge_error(
            "http://demo",
            "/tmp/fine",
            "com.fr.workspace.exception.DiskSpaceFullException: save failed by disk space is full!",
        );

        assert!(message.contains("远端磁盘空间不足"));
        assert!(message.contains("无法保存"));
    }
}
