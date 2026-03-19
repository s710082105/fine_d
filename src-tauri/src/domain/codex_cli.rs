const EXEC_ARGS: &[&str] = &["exec", "--full-auto", "--skip-git-repo-check"];
const RESUME_ARGS: &[&str] = &["exec", "resume", "--full-auto", "--skip-git-repo-check"];
const SESSION_ID_PREFIX: &str = "session id:";

pub fn build_exec_args(config_args: &[String], prompt: &str) -> Vec<String> {
    let mut args = build_args(EXEC_ARGS);
    args.extend(config_args.iter().cloned());
    args.push(prompt.into());
    args
}

pub fn build_resume_args(
    codex_session_id: &str,
    config_args: &[String],
    prompt: &str,
) -> Vec<String> {
    let mut args = build_args(RESUME_ARGS);
    args.extend(config_args.iter().cloned());
    args.push(codex_session_id.into());
    args.push(prompt.into());
    args
}

pub fn parse_codex_session_id(line: &str) -> Option<String> {
    let trimmed = line.trim();
    let prefix = trimmed.get(..SESSION_ID_PREFIX.len())?.to_ascii_lowercase();
    if prefix != SESSION_ID_PREFIX {
        return None;
    }
    let value = trimmed.get(SESSION_ID_PREFIX.len()..)?.trim();
    if value.is_empty() {
        return None;
    }
    Some(value.into())
}

fn build_args(base: &[&str]) -> Vec<String> {
    base.iter().map(|value| (*value).into()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_exec_args_omits_unsupported_color_flag() {
        let args = build_exec_args(&["--json".into()], "生成报表");
        assert_eq!(
            args,
            vec![
                "exec",
                "--full-auto",
                "--skip-git-repo-check",
                "--json",
                "生成报表",
            ]
        );
    }

    #[test]
    fn build_resume_args_places_session_id_before_prompt() {
        let args = build_resume_args("codex-session-1", &["--json".into()], "继续执行");
        assert_eq!(
            args,
            vec![
                "exec",
                "resume",
                "--full-auto",
                "--skip-git-repo-check",
                "--json",
                "codex-session-1",
                "继续执行",
            ]
        );
    }

    #[test]
    fn parse_codex_session_id_reads_stdout_line() {
        assert_eq!(
            parse_codex_session_id("session id: 019d0414-2a88-7e82-a3dc-888f85201bd3"),
            Some("019d0414-2a88-7e82-a3dc-888f85201bd3".into())
        );
        assert_eq!(parse_codex_session_id("started"), None);
    }
}
