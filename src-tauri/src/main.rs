fn main() {
    match finereport_tauri_shell_lib::commands::project_sync::try_run_cli() {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
    finereport_tauri_shell_lib::run()
}
