// Release 模式下隐藏 Windows 控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    match finereport_tauri_shell_lib::commands::project_sync::try_run_cli() {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
    match finereport_tauri_shell_lib::commands::fine_decision::try_run_cli() {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
    finereport_tauri_shell_lib::run()
}
