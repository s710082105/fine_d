"""Build bridge invocation commands."""

from __future__ import annotations

from pathlib import Path


def build_bridge_command(java_path: Path, jar_path: Path, operation: str) -> list[str]:
    return [str(java_path), "-jar", str(jar_path), operation]
