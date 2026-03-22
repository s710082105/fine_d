pub mod commands;
pub mod domain;
#[doc(hidden)]
pub mod test_support;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::terminal::TerminalCommandState::default())
        .invoke_handler(tauri::generate_handler![
            commands::environment::check_codex_installation,
            commands::environment::check_runtime_prerequisites,
            commands::project_config::save_project_config,
            commands::project_config::load_project_config,
            commands::project_config::list_reportlet_entries,
            commands::project_config::test_data_connection,
            commands::project_sync::list_remote_directories,
            commands::project_sync::list_remote_reportlet_entries,
            commands::project_sync::test_remote_sync_connection,
            commands::terminal::create_terminal_session,
            commands::terminal::write_terminal_input,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
