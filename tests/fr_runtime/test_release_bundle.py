import importlib.util
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
BRIDGE_BUILD_SCRIPT = REPO_ROOT / "bridge" / "scripts" / "build_bridge.py"
BUNDLE_SCRIPT = REPO_ROOT / "tooling" / "fr_runtime" / "release_bundle.py"


def _load_module(path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_release_bundle_script_exists() -> None:
    assert BUNDLE_SCRIPT.exists()


def test_build_release_bundle_copies_runtime_files(tmp_path: Path) -> None:
    build_module = _load_module(BRIDGE_BUILD_SCRIPT, "build_bridge")
    bundle_module = _load_module(BUNDLE_SCRIPT, "release_bundle")

    bridge_dist = tmp_path / "bridge-dist"
    build_module.build_bridge(project_root=REPO_ROOT, dist_dir=bridge_dist)
    output_dir = tmp_path / "bundle"

    bundle_module.build_release_bundle(
        project_root=REPO_ROOT,
        output_dir=output_dir,
        bridge_dist_dir=bridge_dist,
    )

    assert (output_dir / ".codex" / "skills" / "fr-init" / "SKILL.md").exists()
    assert (output_dir / "tooling" / "fr_runtime" / "cli.py").exists()
    assert (output_dir / "bridge" / "dist" / "fr-remote-bridge.jar").exists()
    assert (output_dir / "bridge" / "dist" / "manifest.json").exists()
    assert (output_dir / "bridge" / "dist" / "checksums.txt").exists()
    assert (output_dir / "reportlets" / "GettingStarted.cpt").exists()
    assert (output_dir / "README.md").exists()
    assert (output_dir / "pyproject.toml").exists()
    launcher_path = output_dir / "start-codex-windows.ps1"
    assert launcher_path.exists()
    assert not (output_dir / "start-codex-windows.cmd").exists()
    launcher_content = launcher_path.read_text(encoding="utf-8")
    assert '$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path' in launcher_content
    assert "Set-Location -Path $scriptDir" in launcher_content
    assert "Get-Command codex" in launcher_content
    assert "& codex" in launcher_content
    assert not (output_dir / "bridge" / "src").exists()
    assert not (output_dir / "tooling" / "__pycache__").exists()
    assert not any(path.name == ".DS_Store" for path in output_dir.rglob("*"))


def test_build_release_bundle_rejects_missing_bridge_artifacts(tmp_path: Path) -> None:
    bundle_module = _load_module(BUNDLE_SCRIPT, "release_bundle")

    with pytest.raises(FileNotFoundError):
        bundle_module.build_release_bundle(
            project_root=REPO_ROOT,
            output_dir=tmp_path / "bundle",
            bridge_dist_dir=tmp_path / "missing-bridge",
        )
