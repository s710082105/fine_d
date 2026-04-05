import hashlib
import importlib.util
import json
import os
import subprocess
import shutil
import textwrap
import zipfile
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = REPO_ROOT / "bridge" / "src" / "fine" / "remote" / "bridge"
SCRIPT_PATH = REPO_ROOT / "bridge" / "scripts" / "build_bridge.py"
PUBLIC_KEY_PATH = REPO_ROOT / "bridge" / "scripts" / "license-public.pem"
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
    assert PUBLIC_KEY_PATH.exists()
    for source_path in EXPECTED_SOURCES:
        assert source_path.exists(), source_path


def test_build_bridge_uses_repo_public_key_file_by_default() -> None:
    module = _load_build_module()

    assert module.DEFAULT_LICENSE_PUBLIC_KEY_FILE == PUBLIC_KEY_PATH
    assert module._resolve_license_public_key_pem(None) == PUBLIC_KEY_PATH.read_text(encoding="utf-8").strip()


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
    assert "fine/remote/bridge/FineRuntime.class" not in names
    assert "fine/remote/bridge/RequestData.class" not in names
    assert "fine/remote/bridge/JsonOutput.class" not in names
    main_bytecode = _javap_output(artifacts.jar_path, "fine.remote.bridge.Main")
    assert "ensureAuthorized" in main_bytecode
    assert "ensureValid" not in main_bytecode

    major_version = _class_major_version(artifacts.jar_path, "fine/remote/bridge/Main.class")
    assert major_version == 52


@pytest.mark.skipif(
    shutil.which("javac") is None or shutil.which("java") is None or shutil.which("jar") is None,
    reason="javac/java/jar not available",
)
def test_bridge_reflection_support_handles_package_private_targets(tmp_path: Path) -> None:
    module = _load_build_module()
    artifacts = module.build_bridge(
        project_root=REPO_ROOT,
        dist_dir=tmp_path / "dist",
    )
    source_root = tmp_path / "src"
    classes_dir = tmp_path / "classes"
    classes_dir.mkdir()

    _write_java_source(
        source_root / "sample" / "PublicFactory.java",
        """
        package sample;

        public final class PublicFactory {
          private PublicFactory() {
          }

          public static Object createHidden() {
            return HiddenTarget.create();
          }
        }
        """,
    )
    _write_java_source(
        source_root / "sample" / "HiddenTarget.java",
        """
        package sample;

        final class HiddenTarget {
          static Object create() {
            return new HiddenTarget();
          }

          public String hello() {
            return "ok";
          }
        }
        """,
    )
    _write_java_source(
        source_root / "fine" / "remote" / "bridge" / "ReflectionAccessProbe.java",
        """
        package fine.remote.bridge;

        import sample.PublicFactory;

        public final class ReflectionAccessProbe {
          private ReflectionAccessProbe() {
          }

          public static void main(String[] args) throws Exception {
            Object target = PublicFactory.createHidden();
            System.out.print(ReflectionSupport.invoke(target, "hello"));
          }
        }
        """,
    )

    subprocess.run(
        [
            shutil.which("javac") or "javac",
            "--release",
            "8",
            "-cp",
            str(artifacts.jar_path),
            "-d",
            str(classes_dir),
            *[str(path) for path in source_root.rglob("*.java")],
        ],
        check=True,
    )
    result = subprocess.run(
        [
            shutil.which("java") or "java",
            "-cp",
            _classpath([classes_dir, artifacts.jar_path]),
            "fine.remote.bridge.ReflectionAccessProbe",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    assert result.stdout == "ok"


def _class_major_version(jar_path: Path, class_name: str) -> int:
    with zipfile.ZipFile(jar_path) as archive:
        content = archive.read(class_name)
    return int.from_bytes(content[6:8], "big")


def _javap_output(jar_path: Path, class_name: str) -> str:
    return subprocess.check_output(
        [
            shutil.which("javap") or "javap",
            "-classpath",
            str(jar_path),
            "-p",
            "-c",
            class_name,
        ],
        text=True,
    )


def _write_java_source(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content).strip() + "\n")


def _classpath(entries: list[Path]) -> str:
    return str(entries[0]) + os.pathsep + str(entries[1])
