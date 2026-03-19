use crate::domain::project_config::ProjectConfig;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const CODEX_HOME_ENV: &str = "CODEX_HOME";
pub const CODEX_BASE_URL: &str = "http://cpa.hsy.930320.xyz/v1";

const AUTH_FILE_NAME: &str = "auth.json";
const AUTH_HOME_PREFIX: &str = "finereport-codex-home";
const FORCED_LOGIN_METHOD_CONFIG_KEY: &str = "forced_login_method";
const OPENAI_BASE_URL_CONFIG_KEY: &str = "openai_base_url";
const API_LOGIN_METHOD: &str = "api";
const HOME_ENV: &str = "HOME";
const USERPROFILE_ENV: &str = "USERPROFILE";
const SHARED_CODEX_HOME_ENTRIES: &[&str] = &[
    "AGENTS.md",
    "config.toml",
    "rules",
    "skills",
    "superpowers",
    "version.json",
];

#[derive(Serialize)]
struct ApiKeyAuthFile<'a> {
    #[serde(rename = "OPENAI_API_KEY")]
    openai_api_key: &'a str,
}

pub fn append_runtime_config_args(args: &mut Vec<String>, config: &ProjectConfig) {
    push_config_override(args, OPENAI_BASE_URL_CONFIG_KEY, CODEX_BASE_URL);
    if !config.ai.api_key.trim().is_empty() {
        push_config_override(args, FORCED_LOGIN_METHOD_CONFIG_KEY, API_LOGIN_METHOD);
    }
}

pub fn build_codex_environment(
    base_env: Option<&HashMap<String, String>>,
    config: &ProjectConfig,
) -> Result<HashMap<String, String>, String> {
    let mut env = base_env.cloned().unwrap_or_default();
    let api_key = config.ai.api_key.trim();
    if api_key.is_empty() {
        return Ok(env);
    }
    let codex_home = create_codex_home(api_key)?;
    env.insert(CODEX_HOME_ENV.into(), codex_home.display().to_string());
    Ok(env)
}

fn push_config_override(args: &mut Vec<String>, key: &str, value: &str) {
    args.push("-c".into());
    args.push(config_override(key, value));
}

fn config_override(key: &str, value: &str) -> String {
    format!(
        r#"{key}="{}""#,
        value.replace('\\', "\\\\").replace('"', "\\\"")
    )
}

fn create_codex_home(api_key: &str) -> Result<PathBuf, String> {
    let dir = unique_codex_home_dir()?;
    seed_shared_codex_home(dir.as_path())?;
    write_auth_file(dir.as_path(), api_key)?;
    Ok(dir)
}

fn unique_codex_home_dir() -> Result<PathBuf, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("failed to build codex auth dir: {error}"))?
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("{AUTH_HOME_PREFIX}-{nanos}"));
    fs::create_dir_all(&dir)
        .map_err(|error| format!("failed to create codex auth dir {}: {error}", dir.display()))?;
    Ok(dir)
}

fn seed_shared_codex_home(target_dir: &Path) -> Result<(), String> {
    let Some(source_dir) = resolve_shared_codex_home() else {
        return Ok(());
    };
    for entry in SHARED_CODEX_HOME_ENTRIES {
        let source = source_dir.join(entry);
        if !source.exists() {
            continue;
        }
        copy_shared_entry(&source, &target_dir.join(entry))?;
    }
    Ok(())
}

fn copy_shared_entry(source: &Path, target: &Path) -> Result<(), String> {
    let metadata = fs::metadata(source)
        .map_err(|error| format!("failed to inspect codex home entry {}: {error}", source.display()))?;
    if metadata.is_dir() {
        copy_dir_recursive(source, target)
    } else {
        copy_file(source, target)
    }
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target)
        .map_err(|error| format!("failed to create codex home directory {}: {error}", target.display()))?;
    for entry in fs::read_dir(source)
        .map_err(|error| format!("failed to read codex home directory {}: {error}", source.display()))?
    {
        let entry = entry
            .map_err(|error| format!("failed to iterate codex home directory {}: {error}", source.display()))?;
        let child_source = entry.path();
        let child_target = target.join(entry.file_name());
        copy_shared_entry(child_source.as_path(), child_target.as_path())?;
    }
    Ok(())
}

fn copy_file(source: &Path, target: &Path) -> Result<(), String> {
    let Some(parent) = target.parent() else {
        return Err(format!("invalid codex home target path: {}", target.display()));
    };
    fs::create_dir_all(parent).map_err(|error| {
        format!(
            "failed to create codex home parent directory {}: {error}",
            parent.display()
        )
    })?;
    fs::copy(source, target).map_err(|error| {
        format!(
            "failed to copy codex home entry {} -> {}: {error}",
            source.display(),
            target.display()
        )
    })?;
    Ok(())
}

fn resolve_shared_codex_home() -> Option<PathBuf> {
    resolve_env_dir(CODEX_HOME_ENV)
        .or_else(|| resolve_home_dir(HOME_ENV))
        .or_else(|| resolve_home_dir(USERPROFILE_ENV))
}

fn resolve_env_dir(name: &str) -> Option<PathBuf> {
    let path = std::env::var(name).ok()?;
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return None;
    }
    let candidate = PathBuf::from(trimmed);
    candidate.exists().then_some(candidate)
}

fn resolve_home_dir(name: &str) -> Option<PathBuf> {
    let home = resolve_env_dir(name)?;
    let codex_home = home.join(".codex");
    codex_home.exists().then_some(codex_home)
}

fn write_auth_file(dir: &Path, api_key: &str) -> Result<(), String> {
    let auth_path = dir.join(AUTH_FILE_NAME);
    let auth_file = ApiKeyAuthFile {
        openai_api_key: api_key,
    };
    let payload = serde_json::to_vec(&auth_file)
        .map_err(|error| format!("failed to serialize codex auth file: {error}"))?;
    fs::write(&auth_path, payload).map_err(|error| {
        format!(
            "failed to write codex auth file {}: {error}",
            auth_path.display()
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn unique_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("codex_auth_{name}_{nanos}"))
    }

    struct EnvVarGuard {
        key: &'static str,
        previous: Option<String>,
    }

    impl EnvVarGuard {
        fn set(key: &'static str, value: &Path) -> Self {
            let previous = std::env::var(key).ok();
            // SAFETY: tests serialize environment mutations with env_lock().
            unsafe {
                std::env::set_var(key, value);
            }
            Self { key, previous }
        }

        fn unset(key: &'static str) -> Self {
            let previous = std::env::var(key).ok();
            // SAFETY: tests serialize environment mutations with env_lock().
            unsafe {
                std::env::remove_var(key);
            }
            Self { key, previous }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            match &self.previous {
                Some(value) => {
                    // SAFETY: tests serialize environment mutations with env_lock().
                    unsafe {
                        std::env::set_var(self.key, value);
                    }
                }
                None => {
                    // SAFETY: tests serialize environment mutations with env_lock().
                    unsafe {
                        std::env::remove_var(self.key);
                    }
                }
            }
        }
    }

    #[test]
    fn append_runtime_config_args_always_injects_fixed_base_url() {
        let mut args = Vec::new();
        append_runtime_config_args(&mut args, &ProjectConfig::default());
        assert_eq!(
            args,
            vec!["-c", r#"openai_base_url="http://cpa.hsy.930320.xyz/v1""#]
        );
    }

    #[test]
    fn build_codex_environment_copies_shared_entries_and_writes_auth_file() {
        let _guard = env_lock().lock().expect("lock env");
        let source_home = unique_dir("shared");
        fs::create_dir_all(source_home.join("skills/example")).expect("create source skills dir");
        fs::create_dir_all(source_home.join("superpowers/tools")).expect("create source superpowers dir");
        fs::write(source_home.join("config.toml"), "theme = 'light'").expect("write config.toml");
        fs::write(source_home.join("skills/example/SKILL.md"), "# Skill").expect("write skill");
        fs::write(source_home.join("superpowers/tools/readme.txt"), "tooling").expect("write superpowers");
        fs::create_dir_all(source_home.join("memories")).expect("create memories dir");
        fs::write(source_home.join("memories/keep.txt"), "do not copy").expect("write memories");
        let _codex_home = EnvVarGuard::set(CODEX_HOME_ENV, source_home.as_path());
        let _home = EnvVarGuard::unset(HOME_ENV);
        let _userprofile = EnvVarGuard::unset(USERPROFILE_ENV);

        let mut config = ProjectConfig::default();
        config.ai.api_key = "sk-demo".into();
        let env = build_codex_environment(None, &config).expect("build codex environment");
        let isolated_home = PathBuf::from(env.get(CODEX_HOME_ENV).expect("isolated codex home"));

        assert_eq!(
            fs::read_to_string(isolated_home.join("config.toml")).expect("read copied config"),
            "theme = 'light'"
        );
        assert!(isolated_home.join("skills/example/SKILL.md").exists());
        assert!(isolated_home.join("superpowers/tools/readme.txt").exists());
        assert!(!isolated_home.join("memories").exists());
        let auth_content =
            fs::read_to_string(isolated_home.join(AUTH_FILE_NAME)).expect("read auth file");
        assert!(auth_content.contains(r#""OPENAI_API_KEY":"sk-demo""#));
    }

    #[test]
    fn resolve_shared_codex_home_falls_back_to_userprofile() {
        let _guard = env_lock().lock().expect("lock env");
        let userprofile = unique_dir("userprofile");
        let shared_home = userprofile.join(".codex");
        fs::create_dir_all(&shared_home).expect("create userprofile codex home");
        let _codex_home = EnvVarGuard::unset(CODEX_HOME_ENV);
        let _home = EnvVarGuard::unset(HOME_ENV);
        let _userprofile = EnvVarGuard::set(USERPROFILE_ENV, userprofile.as_path());

        assert_eq!(resolve_shared_codex_home(), Some(shared_home));
    }
}
