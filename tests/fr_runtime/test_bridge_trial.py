import importlib.util
import shutil
import subprocess
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "bridge" / "scripts" / "build_bridge.py"


def _load_build_module():
    spec = importlib.util.spec_from_file_location("build_bridge", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.skipif(
    any(shutil.which(name) is None for name in ("javac", "jar", "javap")),
    reason="javac/jar/javap not available",
)
def test_build_bridge_main_does_not_include_trial_guard(tmp_path: Path) -> None:
    module = _load_build_module()
    artifacts = module.build_bridge(
        project_root=REPO_ROOT,
        dist_dir=tmp_path / "dist",
    )

    bytecode = subprocess.check_output(
        [
            shutil.which("javap") or "javap",
            "-classpath",
            str(artifacts.jar_path),
            "-p",
            "-c",
            "fine.remote.bridge.Main",
        ],
        text=True,
    )

    assert "ensureAuthorized" in bytecode
    assert "ensureValid" not in bytecode
    assert "试用过期，请获取正式版" not in bytecode
