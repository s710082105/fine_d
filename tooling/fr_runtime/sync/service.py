"""Synchronize local reportlets with the remote FineReport workspace."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


class BridgeGateway(Protocol):
    def invoke(self, operation: str, payload: dict[str, object]) -> dict[str, object]: ...


def normalize_remote_path(raw_path: str) -> str:
    path = raw_path.replace("\\", "/").lstrip("/")
    if not path.startswith("reportlets/"):
        raise ValueError("remote path must stay under reportlets")
    if "/../" in f"/{path}" or path.endswith("/.."):
        raise ValueError("remote path must stay under reportlets")
    return path


@dataclass(frozen=True)
class SyncService:
    bridge: BridgeGateway
    workspace_root: Path
    template_root: Path

    def pull(self, target_path: str) -> dict[str, object]:
        remote_path = normalize_remote_path(target_path)
        response = self.bridge.invoke("read", {"path": remote_path})
        content = _decode_content(response)
        local_path = _local_path(self.workspace_root, remote_path)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(content)
        return {
            "status": "pulled",
            "remote_path": remote_path,
            "local_path": str(local_path),
            "size": len(content),
        }

    def push(self, target_path: str) -> dict[str, object]:
        remote_path = normalize_remote_path(target_path)
        local_path = _local_path(self.workspace_root, remote_path)
        content = local_path.read_bytes()
        self._ensure_remote_writable(remote_path)
        self.bridge.invoke(
            "write",
            {"path": remote_path, "inputBase64": _encode_content(content)},
        )
        verified = _decode_content(self.bridge.invoke("read", {"path": remote_path}))
        if verified != content:
            raise ValueError(f"remote verification failed for {remote_path}")
        return {
            "status": "verified",
            "remote_path": remote_path,
            "local_path": str(local_path),
            "size": len(content),
        }

    def prepare_edit(self, target_path: str) -> dict[str, object]:
        result = self.pull(target_path)
        return {"action": "prepare-edit", **result}

    def prepare_create(self, target_path: str) -> dict[str, object]:
        remote_path = normalize_remote_path(target_path)
        if self._find_remote_item(remote_path):
            raise FileExistsError(f"remote target already exists: {remote_path}")
        template_path = self._template_path(Path(remote_path).suffix)
        content = template_path.read_bytes()
        self.bridge.invoke(
            "write",
            {"path": remote_path, "inputBase64": _encode_content(content)},
        )
        result = self.pull(remote_path)
        return {"action": "prepare-create", **result}

    def _ensure_remote_writable(self, remote_path: str) -> None:
        item = self._find_remote_item(remote_path)
        if item and item.get("lock"):
            raise PermissionError(f"remote target is locked: {remote_path}")

    def _find_remote_item(self, remote_path: str) -> dict[str, object] | None:
        parent_path = remote_path.rsplit("/", 1)[0]
        response = self.bridge.invoke("list", {"path": parent_path})
        items = response.get("items", [])
        if not isinstance(items, list):
            return None
        for item in items:
            if isinstance(item, dict) and item.get("path") == remote_path:
                return item
        return None

    def _template_path(self, suffix: str) -> Path:
        if suffix not in {".cpt", ".fvs"}:
            raise ValueError(f"unsupported reportlet type: {suffix}")
        return self.template_root / f"blank{suffix}"


def _decode_content(response: dict[str, object]) -> bytes:
    content = response.get("contentBase64")
    if not isinstance(content, str):
        raise ValueError("bridge response missing contentBase64")
    return base64.b64decode(content.encode("ascii"))


def _encode_content(content: bytes) -> str:
    return base64.b64encode(content).decode("ascii")


def _local_path(workspace_root: Path, remote_path: str) -> Path:
    return workspace_root / Path(normalize_remote_path(remote_path))
