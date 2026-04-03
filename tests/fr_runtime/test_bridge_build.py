import hashlib
import importlib.util
import json
import shutil
import zipfile
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = REPO_ROOT / "bridge" / "src" / "fine" / "remote" / "bridge"
SCRIPT_PATH = REPO_ROOT / "bridge" / "scripts" / "build_bridge.py"
EXPECTED_SOURCES = [
    SOURCE_ROOT / "Main.java",
    SOURCE_ROOT / "RequestData.java",
    SOURCE_ROOT / "JsonOutput.java",
    SOURCE_ROOT / "FineRuntime.java",
]


def _load_build_module():
    spec = importlib.util.spec_from_file_location("build_bridge", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_bridge_sources_exist() -> None:
    assert SCRIPT_PATH.exists()
    for source_path in EXPECTED_SOURCES:
        assert source_path.exists(), source_path


@pytest.mark.skipif(
    shutil.which("javac") is None or shutil.which("jar") is None,
    reason="javac/jar not available",
)
def test_build_bridge_generates_runtime_artifacts(tmp_path: Path) -> None:
    module = _load_build_module()
    dist_dir = tmp_path / "dist"

    artifacts = module.build_bridge(
        project_root=REPO_ROOT,
        dist_dir=dist_dir,
    )

    assert artifacts.jar_path == dist_dir / "fr-remote-bridge.jar"
    assert artifacts.manifest_path == dist_dir / "manifest.json"
    assert artifacts.checksum_path == dist_dir / "checksums.txt"
    assert artifacts.jar_path.exists()
    assert artifacts.manifest_path.exists()
    assert artifacts.checksum_path.exists()

    manifest = json.loads(artifacts.manifest_path.read_text())
    assert manifest == {
        "name": "fr-remote-bridge",
        "version": "0.1.0",
        "main_class": "fine.remote.bridge.Main",
        "supported_operations": [
            "list",
            "read",
            "write",
            "delete",
            "encrypt",
            "encrypt-transmission",
        ],
        "fine_report_versions": ["11.0"],
        "requires_designer_java": True,
        "artifact_present": True,
    }

    digest = hashlib.sha256(artifacts.jar_path.read_bytes()).hexdigest()
    checksum_line = artifacts.checksum_path.read_text().strip()
    assert checksum_line == f"{digest}  fr-remote-bridge.jar"

    with zipfile.ZipFile(artifacts.jar_path) as archive:
        names = set(archive.namelist())
    assert "fine/remote/bridge/Main.class" in names
    assert "fine/remote/bridge/FineRuntime.class" in names

    major_version = _class_major_version(artifacts.jar_path, "fine/remote/bridge/Main.class")
    assert major_version == 52


def _class_major_version(jar_path: Path, class_name: str) -> int:
    with zipfile.ZipFile(jar_path) as archive:
        content = archive.read(class_name)
    return int.from_bytes(content[6:8], "big")
