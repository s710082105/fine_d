"""Helpers around bundled Designer Java and bridge artifacts."""

from __future__ import annotations

from pathlib import Path


def validate_bridge_artifacts(jar_path: Path, manifest_path: Path) -> None:
    if not jar_path.exists():
        raise FileNotFoundError(jar_path)
    if not manifest_path.exists():
        raise FileNotFoundError(manifest_path)
