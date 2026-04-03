"""Build a directly usable runtime bundle for CI artifacts."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from tooling.fr_runtime.bridge.java_runtime import validate_bridge_artifacts


BUNDLE_PATHS = [
    Path(".codex"),
    Path("tooling"),
    Path("reportlets"),
    Path("README.md"),
    Path("pyproject.toml"),
    Path("AGENTS.md"),
]
IGNORED_NAMES = {"__pycache__", ".pytest_cache", ".DS_Store"}
IGNORED_SUFFIXES = {".pyc", ".pyo"}
WINDOWS_LAUNCHER_NAME = "start-codex-windows.ps1"
WINDOWS_LAUNCHER_CONTENT = """$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $scriptDir
$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
if (-not $codexCommand) {
  Write-Host "[ERROR] codex command not found in PATH."
  Write-Host "Install Codex CLI first, then run this launcher again."
  Read-Host "Press Enter to exit" | Out-Null
  exit 1
}
& codex
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {
  $exitCode = 0
}
if ($exitCode -ne 0) {
  Write-Host ""
  Write-Host "Codex exited with code $exitCode."
  Read-Host "Press Enter to exit" | Out-Null
}
exit $exitCode
"""


def build_release_bundle(
    project_root: Path,
    output_dir: Path,
    bridge_dist_dir: Path | None = None,
) -> Path:
    bridge_dir = bridge_dist_dir or (project_root / "bridge" / "dist")
    _validate_bridge_dir(bridge_dir)
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)
    for relative_path in BUNDLE_PATHS:
        source = project_root / relative_path
        _copy_entry(source, output_dir / relative_path)
    _copy_entry(bridge_dir, output_dir / "bridge" / "dist")
    _write_windows_launcher(output_dir)
    return output_dir


def _validate_bridge_dir(bridge_dir: Path) -> None:
    validate_bridge_artifacts(
        jar_path=bridge_dir / "fr-remote-bridge.jar",
        manifest_path=bridge_dir / "manifest.json",
        checksum_path=bridge_dir / "checksums.txt",
    )


def _copy_entry(source: Path, destination: Path) -> None:
    if not source.exists():
        raise FileNotFoundError(source)
    if source.is_dir():
        shutil.copytree(
            source,
            destination,
            ignore=shutil.ignore_patterns(*IGNORED_NAMES, "*.pyc", "*.pyo"),
        )
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def _write_windows_launcher(output_dir: Path) -> None:
    launcher_path = output_dir / WINDOWS_LAUNCHER_NAME
    launcher_path.write_text(WINDOWS_LAUNCHER_CONTENT, encoding="utf-8", newline="\r\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build a runtime bundle for CI downloads.")
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument("--output-dir", type=Path, default=Path("dist/finereport-runtime-bundle"))
    parser.add_argument("--bridge-dist-dir", type=Path)
    args = parser.parse_args(argv)
    project_root = args.project_root.resolve()
    output_dir = args.output_dir.resolve() if args.output_dir.is_absolute() else project_root / args.output_dir
    bridge_dist_dir = None
    if args.bridge_dist_dir is not None:
        bridge_dist_dir = (
            args.bridge_dist_dir.resolve()
            if args.bridge_dist_dir.is_absolute()
            else project_root / args.bridge_dist_dir
        )
    build_release_bundle(project_root, output_dir, bridge_dist_dir)
    return 0


__all__ = ["build_release_bundle", "main"]


if __name__ == "__main__":
    raise SystemExit(main())
