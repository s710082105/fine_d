use std::path::Path;

const WINDOWS_PYTHON_LAUNCHER: &str = "py";
const WINDOWS_PYTHON_VERSION_ARG: &str = "-3";
const UNIX_PYTHON_COMMAND: &str = "python3";
const INLINE_SCRIPT_ARG: &str = "-c";
const ONE_SECOND: u8 = 1;
const WINDOWS_TERMINAL_LINE_ENDING: &str = "\r";
const UNIX_TERMINAL_LINE_ENDING: &str = "\n";

pub fn python_command(script: &str) -> (String, Vec<String>) {
    if cfg!(target_os = "windows") {
        return (
            WINDOWS_PYTHON_LAUNCHER.into(),
            vec![
                WINDOWS_PYTHON_VERSION_ARG.into(),
                INLINE_SCRIPT_ARG.into(),
                script.into(),
            ],
        );
    }
    (
        UNIX_PYTHON_COMMAND.into(),
        vec![INLINE_SCRIPT_ARG.into(), script.into()],
    )
}

pub fn python_exit_script(code: i32) -> String {
    format!("import sys; sys.exit({code})")
}

pub fn python_print_line_script(line: &str) -> String {
    format!("print({}, flush=True)", python_literal(line))
}

pub fn python_print_no_newline_script(line: &str) -> String {
    format!(
        "import sys, time; sys.stdout.write({}); sys.stdout.flush(); time.sleep({ONE_SECOND})",
        python_literal(line)
    )
}

pub fn python_long_running_script() -> String {
    format!("import time\nwhile True:\n    time.sleep({ONE_SECOND})")
}

pub fn python_pid_script(path: &Path) -> String {
    format!(
        "import os, pathlib, time; pathlib.Path({}).write_text(str(os.getpid()), encoding='utf-8');\nwhile True:\n    time.sleep({ONE_SECOND})",
        python_literal(path.display().to_string().as_str())
    )
}

pub fn python_split_utf8_script(line: &str) -> String {
    format!(
        "import sys, time; data = {}.encode('utf-8'); sys.stdout.buffer.write(data[:2]); sys.stdout.buffer.flush(); time.sleep({ONE_SECOND}); sys.stdout.buffer.write(data[2:]); sys.stdout.buffer.flush(); time.sleep({ONE_SECOND})",
        python_literal(line)
    )
}

pub fn python_input_echo_script() -> String {
    format!(
        "import sys, time; print('ready', flush=True); line = sys.stdin.readline().rstrip('\\r\\n'); print(f'input:{{line}}', flush=True);\nwhile True:\n    time.sleep({ONE_SECOND})"
    )
}

pub fn terminal_input_line(line: &str) -> String {
    format!("{line}{}", terminal_line_ending())
}

fn python_literal(value: &str) -> String {
    format!("{value:?}")
}

fn terminal_line_ending() -> &'static str {
    if cfg!(target_os = "windows") {
        return WINDOWS_TERMINAL_LINE_ENDING;
    }
    UNIX_TERMINAL_LINE_ENDING
}

#[cfg(test)]
mod tests {
    use super::{python_input_echo_script, python_split_utf8_script, terminal_input_line};

    #[test]
    fn python_input_echo_script_normalizes_windows_newlines() {
        let script = python_input_echo_script();
        assert!(script.contains("rstrip('\\r\\n')"));
    }

    #[test]
    fn python_split_utf8_script_waits_after_final_flush() {
        let script = python_split_utf8_script("中\n");
        assert_eq!(script.matches("time.sleep(1)").count(), 2);
    }

    #[test]
    fn terminal_input_line_uses_platform_line_endings() {
        let payload = terminal_input_line("hello-terminal");
        if cfg!(target_os = "windows") {
            assert_eq!(payload, "hello-terminal\r");
            return;
        }
        assert_eq!(payload, "hello-terminal\n");
    }
}
