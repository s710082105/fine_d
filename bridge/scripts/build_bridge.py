from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import NamedTuple


BRIDGE_NAME = "fr-remote-bridge"
VERSION = "0.1.0"
MAIN_CLASS = "fine.remote.bridge.Main"
JAVA_RELEASE = "8"
DEFAULT_AUTHORIZATION_FILE_NAME = "fr-remote-bridge.auth"
DEFAULT_LICENSE_PUBLIC_KEY_FILE = Path(__file__).resolve().with_name("license-public.pem")
OBFUSCATED_CLASS_NAMES = {
    "AuthorizationGuard": "A",
    "AuthorizationException": "X",
    "AuthorizationBuildConfig": "P",
    "FineRuntime": "R",
    "TransmissionBridge": "T",
    "WorkspaceBridge": "W",
    "RequestData": "D",
    "FineLoader": "L",
    "BridgeContext": "C",
    "JsonOutput": "J",
    "MacAddressResolver": "M",
    "TrialGuard": "G",
    "TrialExpiredException": "E",
    "NtpTimeClient": "N",
    "TrialBuildConfig": "B",
}
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
    license_public_key_file: Path | None = None,
) -> BuildArtifacts:
    source_root = project_root / "bridge" / "src"
    output_dir = dist_dir or (project_root / "bridge" / "dist")
    output_dir.mkdir(parents=True, exist_ok=True)
    if not source_root.exists():
        raise FileNotFoundError(source_root)

    javac = _resolve_tool(javac_cmd or "javac")
    jar = _resolve_tool(jar_cmd or "jar")
    license_public_key_pem = _resolve_license_public_key_pem(license_public_key_file)

    with tempfile.TemporaryDirectory(prefix="fr-bridge-build-") as temp_dir:
        temp_root = Path(temp_dir)
        prepared_source_root = temp_root / "source"
        _prepare_sources(
            source_root,
            prepared_source_root,
            license_public_key_pem,
        )
        sources = sorted(prepared_source_root.rglob("*.java"))
        if not sources:
            raise FileNotFoundError(f"no Java sources found under {source_root}")
        classes_dir = Path(temp_dir) / "classes"
        classes_dir.mkdir()
        _run(
            [
                javac,
                "--release",
                JAVA_RELEASE,
                "-Xlint:-options",
                "-encoding",
                "UTF-8",
                "-g:none",
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


def _resolve_license_public_key_pem(value: Path | None) -> str:
    env_value = os.environ.get("FR_BRIDGE_LICENSE_PUBLIC_KEY_FILE")
    candidate = value or (Path(env_value) if env_value else None) or DEFAULT_LICENSE_PUBLIC_KEY_FILE
    public_key = candidate.read_text(encoding="utf-8").strip()
    if not public_key:
        raise ValueError(f"license public key file is empty: {candidate}")
    return public_key


def _prepare_sources(
    source_root: Path,
    output_root: Path,
    license_public_key_pem: str,
) -> None:
    shutil.copytree(source_root, output_root)
    _write_authorization_build_config(output_root, license_public_key_pem)
    _obfuscate_sources(output_root)


def _write_authorization_build_config(output_root: Path, license_public_key_pem: str) -> None:
    config_path = output_root / "fine" / "remote" / "bridge" / "AuthorizationBuildConfig.java"
    config_path.write_text(
        "\n".join(
            [
                "package fine.remote.bridge;",
                "",
                "final class AuthorizationBuildConfig {",
                f"  private static final String AUTHORIZATION_FILE_NAME = {json.dumps(DEFAULT_AUTHORIZATION_FILE_NAME)};",
                f"  private static final String PUBLIC_KEY_PEM = {json.dumps(license_public_key_pem)};",
                "",
                "  private AuthorizationBuildConfig() {",
                "  }",
                "",
                "  static String authorizationFileName() {",
                "    return AUTHORIZATION_FILE_NAME;",
                "  }",
                "",
                "  static String publicKeyPem() {",
                "    return PUBLIC_KEY_PEM;",
                "  }",
                "}",
                "",
            ]
        ),
        encoding="utf-8",
    )


def _obfuscate_sources(output_root: Path) -> None:
    java_files = sorted(output_root.rglob("*.java"))
    for path in java_files:
        content = path.read_text()
        path.write_text(_rename_tokens(content, OBFUSCATED_CLASS_NAMES))
    for original_name, obfuscated_name in OBFUSCATED_CLASS_NAMES.items():
        source_path = output_root / "fine" / "remote" / "bridge" / f"{original_name}.java"
        if source_path.exists():
            source_path.rename(source_path.with_name(f"{obfuscated_name}.java"))


def _rename_tokens(content: str, replacements: dict[str, str]) -> str:
    updated = content
    for source, target in replacements.items():
        updated = re.sub(rf"\b{source}\b", target, updated)
    return updated


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
    parser.add_argument("--license-public-key-file", type=Path)
    args = parser.parse_args(argv)
    build_bridge(
        project_root=args.project_root.resolve(),
        dist_dir=args.dist_dir.resolve() if args.dist_dir else None,
        javac_cmd=args.javac_cmd,
        jar_cmd=args.jar_cmd,
        license_public_key_file=args.license_public_key_file.resolve() if args.license_public_key_file else None,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
