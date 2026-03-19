fn main() {
    println!("cargo:rerun-if-changed=capabilities");
    println!("cargo:rerun-if-changed=capabilities/default.json");
    let attributes =
        tauri_build::Attributes::new().capabilities_path_pattern("./capabilities/**/*");
    tauri_build::try_build(attributes).expect("failed to run tauri build script");
}
