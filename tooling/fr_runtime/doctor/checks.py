"""Local and remote checks used by `fr-status-check`."""

from __future__ import annotations

import os
import platform
from pathlib import Path

from tooling.fr_runtime.bridge.java_runtime import read_manifest, validate_bridge_artifacts
from tooling.fr_runtime.config.models import RuntimeConfig

from .report import CheckResult


MAC_JAVA = Path("Contents/runtime/Contents/Home/bin/java")
INSTALL4J_JAVA = Path(".install4j/jre.bundle/Contents/Home/bin/java")
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
    for candidate in (MAC_JAVA, INSTALL4J_JAVA, WIN_JAVA, WIN_RUNTIME_JAVA):
        full_path = designer_root / candidate
        if full_path.exists():
            return full_path
    raise FileNotFoundError("designer bundled java not found")


def collect_runtime_checks(
    config: RuntimeConfig,
    repo_root: Path,
    decision_client: object,
    bridge_runner: object,
) -> list[CheckResult]:
    results = [CheckResult("OS", "通过", detect_platform())]
    java_path = detect_designer_java(config.designer_root)
    results.append(CheckResult("Designer Java", "通过", str(java_path)))
    results.extend(_bridge_checks(repo_root))
    results.extend(_remote_checks(config, decision_client, bridge_runner))
    results.append(_local_reportlets_check(config))
    return results


def _bridge_checks(repo_root: Path) -> list[CheckResult]:
    bridge_dir = repo_root / "bridge" / "dist"
    jar_path = bridge_dir / "fr-remote-bridge.jar"
    manifest_path = bridge_dir / "manifest.json"
    checksum_path = bridge_dir / "checksums.txt"
    validate_bridge_artifacts(jar_path, manifest_path, checksum_path)
    manifest = read_manifest(manifest_path)
    operations = manifest.get("supported_operations", [])
    return [
        CheckResult("Bridge Manifest", "通过", str(manifest_path)),
        CheckResult("Bridge Jar", "通过", ",".join(str(item) for item in operations)),
    ]


def _remote_checks(
    config: RuntimeConfig,
    decision_client: object,
    bridge_runner: object,
) -> list[CheckResult]:
    connections = decision_client.list_connections(config.username, config.password)
    listing = bridge_runner.invoke("list", {"path": config.remote_root})
    items = listing.get("items", [])
    item_count = len(items) if isinstance(items, list) else 0
    return [
        CheckResult("Decision Login", "通过", config.decision_url),
        CheckResult("Remote Connections", "通过", f"{len(connections)} available"),
        CheckResult("Remote Reportlets", "通过", f"{item_count} items under {config.remote_root}"),
    ]


def _local_reportlets_check(config: RuntimeConfig) -> CheckResult:
    local_root = config.workspace_root / config.remote_root
    writable = local_root.exists() and os.access(local_root, os.W_OK)
    workspace_ready = os.access(config.workspace_root, os.W_OK)
    if writable or workspace_ready:
        return CheckResult("Local Reportlets", "通过", str(local_root))
    return CheckResult("Local Reportlets", "失败", str(local_root))
