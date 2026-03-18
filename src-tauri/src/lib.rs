pub mod commands;
pub mod domain;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(commands::session::SessionCommandState::default())
    .invoke_handler(tauri::generate_handler![
      commands::project_config::save_project_config,
      commands::project_config::load_project_config,
      commands::session::start_session,
      commands::session_control::refresh_session_context_command,
      commands::session_control::interrupt_session_command
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application")
}
