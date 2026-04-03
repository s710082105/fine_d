from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import NamedTuple


BRIDGE_NAME = "fr-remote-bridge"
VERSION = "0.1.0"
MAIN_CLASS = "fine.remote.bridge.Main"
JAVA_RELEASE = "8"
SUPPORTED_OPERATIONS = [
    "list",
    "read",
    "write",
    "delete",
    "encrypt",
    "encrypt-transmission",
]


class BuildArtifacts(NamedTuple):
    jar_path: Path
    manifest_path: Path
    checksum_path: Path


def build_bridge(
    project_root: Path,
    dist_dir: Path | None = None,
    javac_cmd: str | None = None,
    jar_cmd: str | None = None,
) -> BuildArtifacts:
    source_root = project_root / "bridge" / "src"
    output_dir = dist_dir or (project_root / "bridge" / "dist")
    output_dir.mkdir(parents=True, exist_ok=True)
    sources = sorted(source_root.rglob("*.java"))
    if not sources:
        raise FileNotFoundError(f"no Java sources found under {source_root}")

    javac = _resolve_tool(javac_cmd or "javac")
    jar = _resolve_tool(jar_cmd or "jar")

    with tempfile.TemporaryDirectory(prefix="fr-bridge-build-") as temp_dir:
        classes_dir = Path(temp_dir) / "classes"
        classes_dir.mkdir()
        _run(
            [
                javac,
                "--release",
                JAVA_RELEASE,
                "-encoding",
                "UTF-8",
                "-d",
                str(classes_dir),
                *map(str, sources),
            ]
        )
        jar_path = output_dir / f"{BRIDGE_NAME}.jar"
        _run([jar, "cfe", str(jar_path), MAIN_CLASS, "-C", str(classes_dir), "."])

    manifest_path = output_dir / "manifest.json"
    checksum_path = output_dir / "checksums.txt"
    manifest_path.write_text(json.dumps(_manifest_payload(), indent=2) + "\n")
    checksum_path.write_text(f"{_sha256_file(jar_path)}  {jar_path.name}\n")
    return BuildArtifacts(jar_path=jar_path, manifest_path=manifest_path, checksum_path=checksum_path)


def _manifest_payload() -> dict[str, object]:
    return {
        "name": BRIDGE_NAME,
        "version": VERSION,
        "main_class": MAIN_CLASS,
        "supported_operations": SUPPORTED_OPERATIONS,
        "fine_report_versions": ["11.0"],
        "requires_designer_java": True,
        "artifact_present": True,
    }


def _resolve_tool(command: str) -> str:
    direct = Path(command)
    if direct.exists():
        return str(direct)

    resolved = shutil.which(command)
    if resolved:
        return resolved

    java_home = os.environ.get("JAVA_HOME")
    if java_home:
        suffix = ".exe" if os.name == "nt" else ""
        candidate = Path(java_home) / "bin" / f"{command}{suffix}"
        if candidate.exists():
            return str(candidate)
    raise FileNotFoundError(f"required tool not found: {command}")


def _run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build the FineReport remote bridge jar.")
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument("--dist-dir", type=Path)
    parser.add_argument("--javac", dest="javac_cmd")
    parser.add_argument("--jar", dest="jar_cmd")
    args = parser.parse_args(argv)
    build_bridge(
        project_root=args.project_root.resolve(),
        dist_dir=args.dist_dir.resolve() if args.dist_dir else None,
        javac_cmd=args.javac_cmd,
        jar_cmd=args.jar_cmd,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
