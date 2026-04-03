"""Helpers around bundled Designer Java and bridge artifacts."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


def read_manifest(manifest_path: Path) -> dict[str, object]:
    return json.loads(manifest_path.read_text())


def validate_bridge_artifacts(
    jar_path: Path,
    manifest_path: Path,
    checksum_path: Path | None = None,
) -> None:
    if not jar_path.exists():
        raise FileNotFoundError(jar_path)
    if not manifest_path.exists():
        raise FileNotFoundError(manifest_path)
    if checksum_path is None or not checksum_path.exists():
        return
    expected = _read_expected_checksum(checksum_path, jar_path.name)
    actual = _sha256_file(jar_path)
    if expected != actual:
        raise ValueError(f"bridge checksum mismatch: {actual}")


def _read_expected_checksum(checksum_path: Path, artifact_name: str) -> str:
    for line in checksum_path.read_text().splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[1] == artifact_name:
            return parts[0]
    raise ValueError(f"missing checksum for {artifact_name}")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()
