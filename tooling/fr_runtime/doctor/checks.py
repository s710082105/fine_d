"""Local detection logic used by `fr-status-check`."""

from __future__ import annotations

import platform
from pathlib import Path


MAC_JAVA = Path("Contents/runtime/Contents/Home/bin/java")
WIN_JAVA = Path("jre/bin/java.exe")
WIN_RUNTIME_JAVA = Path("runtime/bin/java.exe")


def detect_platform() -> str:
    system = platform.system().lower()
    if system == "darwin":
        return "macOS"
    if system == "windows":
        return "Windows"
    return "Linux"


def detect_designer_java(designer_root: Path) -> Path:
    for candidate in (MAC_JAVA, WIN_JAVA, WIN_RUNTIME_JAVA):
        full_path = designer_root / candidate
        if full_path.exists():
            return full_path
    raise FileNotFoundError("designer bundled java not found")
