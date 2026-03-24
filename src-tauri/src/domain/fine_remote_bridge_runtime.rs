use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const RUNTIME_DIR_NAME: &str = "fine_remote_bridge_runtime";
const PYTHON_ROOT: &str = "python";

struct EmbeddedFile {
    relative_path: &'static str,
    content: &'static [u8],
}

const EMBEDDED_FILES: [EmbeddedFile; 6] = [
    EmbeddedFile {
        relative_path: "python/fine_remote/__init__.py",
        content: include_bytes!("../../../python/fine_remote/__init__.py"),
    },
    EmbeddedFile {
        relative_path: "python/fine_remote/cli.py",
        content: include_bytes!("../../../python/fine_remote/cli.py"),
    },
    EmbeddedFile {
        relative_path: "python/fine_remote/client.py",
        content: include_bytes!("../../../python/fine_remote/client.py"),
    },
    EmbeddedFile {
        relative_path: "python/fine_remote/jvm.py",
        content: include_bytes!("../../../python/fine_remote/jvm.py"),
    },
    EmbeddedFile {
        relative_path: "java/fine_remote/FrRemoteBridge.class",
        content: include_bytes!("../../../java/fine_remote/FrRemoteBridge.class"),
    },
    EmbeddedFile {
        relative_path: "java/fine_remote/FrRemoteBridge$Arguments.class",
        content: include_bytes!("../../../java/fine_remote/FrRemoteBridge$Arguments.class"),
    },
];

#[derive(Clone)]
pub struct FineRemoteBridgeRuntime {
    pub working_dir: PathBuf,
    pub python_path: PathBuf,
}

pub fn prepare_bridge_runtime() -> Result<FineRemoteBridgeRuntime, String> {
    let root = env::temp_dir().join(RUNTIME_DIR_NAME);
    stage_bridge_runtime(root.as_path())?;
    Ok(FineRemoteBridgeRuntime {
        working_dir: root.clone(),
        python_path: root.join(PYTHON_ROOT),
    })
}

fn stage_bridge_runtime(root: &Path) -> Result<(), String> {
    for file in EMBEDDED_FILES {
        write_embedded_file(root, file)?;
    }
    Ok(())
}

fn write_embedded_file(root: &Path, file: EmbeddedFile) -> Result<(), String> {
    let path = root.join(file.relative_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create bridge runtime directory: {error}"))?;
    }
    fs::write(&path, file.content)
        .map_err(|error| format!("failed to write bridge runtime file: {error}"))
}

#[cfg(test)]
mod tests {
    use super::stage_bridge_runtime;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    const PYTHON_PACKAGE: &str = "fine_remote";

    fn temp_dir(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("{prefix}_{nanos}"))
    }

    #[test]
    fn stage_bridge_runtime_writes_python_package_and_java_class() {
        let root = temp_dir("fine_remote_bridge_runtime");
        stage_bridge_runtime(root.as_path()).expect("stage bridge runtime");

        assert!(root
            .join("python")
            .join(PYTHON_PACKAGE)
            .join("cli.py")
            .exists());
        assert!(root.join("java/fine_remote/FrRemoteBridge.class").exists());
        assert!(root
            .join("java/fine_remote/FrRemoteBridge$Arguments.class")
            .exists());

        let jvm_source =
            fs::read_to_string(root.join("python").join(PYTHON_PACKAGE).join("jvm.py"))
                .expect("read staged jvm source");
        assert!(
            jvm_source.contains("os.pathsep"),
            "staged jvm bridge should use platform-specific classpath separator"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn stage_bridge_runtime_overwrites_stale_embedded_files() {
        let root = temp_dir("fine_remote_bridge_runtime");
        let stale_path = root.join("python").join(PYTHON_PACKAGE).join("cli.py");
        fs::create_dir_all(stale_path.parent().expect("stale file parent"))
            .expect("create stale parent");
        fs::write(&stale_path, "stale").expect("write stale file");

        stage_bridge_runtime(root.as_path()).expect("restage bridge runtime");

        let restored = fs::read_to_string(&stale_path).expect("read restored file");
        assert!(restored.contains("def build_parser()"));

        let _ = fs::remove_dir_all(root);
    }
}
