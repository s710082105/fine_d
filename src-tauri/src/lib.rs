pub mod commands;
pub mod domain;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      commands::project_config::save_project_config,
      commands::project_config::load_project_config
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application")
}
