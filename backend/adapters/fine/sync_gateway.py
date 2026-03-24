import os
from pathlib import Path
from typing import TYPE_CHECKING, Any

from backend.domain.project.errors import AppError

if TYPE_CHECKING:
    from fine_remote.client import FineRemoteClient, RemoteFileEntry

REMOTE_ROOT_ENV = "FINE_REMOTE_REPORTLETS_ROOT"
ERROR_SOURCE = "sync"


class FineSyncGateway:
    def __init__(
        self,
        client: Any,
        local_root: Path,
        remote_root: str,
    ) -> None:
        self._client = client
        self._local_root = Path(local_root)
        self._remote_root = remote_root.strip("/\\") or "reportlets"
        self._local_root.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_env(
        cls,
        local_root: Path,
    ) -> "FineSyncGateway":
        from fine_remote.client import FineRemoteClient

        return cls(
            client=FineRemoteClient(
                base_url=_required_env("FINE_REMOTE_URL"),
                username=_required_env("FINE_REMOTE_USERNAME"),
                password=_required_env("FINE_REMOTE_PASSWORD"),
                fine_home=Path(_required_env("FINE_REMOTE_HOME")),
            ),
            local_root=local_root,
            remote_root=os.environ.get(REMOTE_ROOT_ENV, "reportlets"),
        )

    def sync_file(self, path: str) -> None:
        local_path = self._resolve_local_file(path)
        remote_path = self._resolve_remote_path(path)
        self._require_remote_file_ready(remote_path, "同步")
        self._write_remote_file(local_path, remote_path)
        self._assert_same_content(local_path, remote_path)

    def sync_directory(self, path: str | None = None) -> None:
        local_dir = self._resolve_local_directory(path)
        for local_file in sorted(candidate for candidate in local_dir.rglob("*") if candidate.is_file()):
            relative_path = local_file.relative_to(self._local_root).as_posix()
            self.sync_file(relative_path)

    def pull_remote_file(self, path: str) -> None:
        remote_path = self._resolve_remote_path(path)
        self._require_remote_file_ready(remote_path, "拉取")
        content = self._read_remote_file(remote_path)
        local_path = self._resolve_local_path(path)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(content)

    def verify_remote_state(self, path: str | None = None) -> None:
        local_path = self._resolve_local_path(path) if path else self._local_root
        if local_path.is_dir():
            for local_file in sorted(candidate for candidate in local_path.rglob("*") if candidate.is_file()):
                relative_path = local_file.relative_to(self._local_root).as_posix()
                self._assert_same_content(local_file, self._resolve_remote_path(relative_path))
            return
        self._assert_same_content(local_path, self._resolve_remote_path(path or ""))

    def _resolve_local_directory(self, path: str | None) -> Path:
        local_path = self._resolve_local_path(path)
        if not local_path.exists():
            raise AppError(
                code="sync.not_found",
                message="local sync directory does not exist",
                detail={"path": path or "."},
                source=ERROR_SOURCE,
            )
        if not local_path.is_dir():
            raise AppError(
                code="sync.invalid_directory",
                message="sync target must be a directory",
                detail={"path": path},
                source=ERROR_SOURCE,
            )
        return local_path

    def _resolve_local_file(self, path: str) -> Path:
        local_path = self._resolve_local_path(path)
        if not local_path.exists():
            raise AppError(
                code="sync.not_found",
                message="local sync file does not exist",
                detail={"path": path},
                source=ERROR_SOURCE,
            )
        if not local_path.is_file():
            raise AppError(
                code="sync.invalid_file",
                message="sync target must be a file",
                detail={"path": path},
                source=ERROR_SOURCE,
            )
        return local_path

    def _resolve_local_path(self, path: str | None) -> Path:
        relative = Path(path or ".")
        candidate = (self._local_root / relative).resolve()
        try:
            candidate.relative_to(self._local_root.resolve())
        except ValueError as error:
            raise AppError(
                code="sync.invalid_path",
                message="sync path must stay inside reportlets",
                detail={"path": path},
                source=ERROR_SOURCE,
            ) from error
        return candidate

    def _resolve_remote_path(self, path: str) -> str:
        relative = path.strip().replace("\\", "/").strip("/")
        return "/".join(part for part in [self._remote_root, relative] if part)

    def _require_remote_file_ready(self, remote_path: str, action: str) -> None:
        entry = self._inspect_remote_file(remote_path)
        if entry is None:
            raise AppError(
                code="sync.remote_not_found",
                message=f"remote file is required before {action.lower()}",
                detail={"remote_path": remote_path, "action": action},
                source=ERROR_SOURCE,
            )
        if entry.is_directory:
            raise AppError(
                code="sync.invalid_remote_file",
                message="remote sync target must be a file",
                detail={"remote_path": remote_path},
                source=ERROR_SOURCE,
            )
        if entry.lock and entry.lock.strip():
            raise AppError(
                code="sync.remote_locked",
                message="remote sync target is locked",
                detail={"remote_path": remote_path, "lock": entry.lock},
                source=ERROR_SOURCE,
            )

    def _inspect_remote_file(self, remote_path: str) -> "RemoteFileEntry | None":
        parent_path = _remote_parent_path(remote_path)
        target_name = remote_path.rsplit("/", maxsplit=1)[-1]
        entries = self._list_remote_files(parent_path)
        for entry in entries:
            entry_path = entry.path.replace("\\", "/").rstrip("/")
            if entry_path == remote_path or entry_path.rsplit("/", maxsplit=1)[-1] == target_name:
                return entry
        return None

    def _list_remote_files(self, path: str) -> list["RemoteFileEntry"]:
        try:
            return self._client.list_files(path)
        except Exception as error:
            raise AppError(
                code="sync.gateway_failed",
                message=f"failed to inspect remote path: {error}",
                detail={"remote_path": path},
                source=ERROR_SOURCE,
            ) from error

    def _read_remote_file(self, remote_path: str) -> bytes:
        try:
            return self._client.read_file(remote_path)
        except Exception as error:
            raise AppError(
                code="sync.gateway_failed",
                message=f"failed to read remote file: {error}",
                detail={"remote_path": remote_path},
                source=ERROR_SOURCE,
            ) from error

    def _write_remote_file(self, local_path: Path, remote_path: str) -> None:
        try:
            self._client.write_file(remote_path, local_path.read_bytes())
        except Exception as error:
            raise AppError(
                code="sync.gateway_failed",
                message=f"failed to write remote file: {error}",
                detail={"local_path": local_path.as_posix(), "remote_path": remote_path},
                source=ERROR_SOURCE,
            ) from error

    def _assert_same_content(self, local_path: Path, remote_path: str) -> None:
        remote_content = self._read_remote_file(remote_path)
        if remote_content == local_path.read_bytes():
            return
        raise AppError(
            code="sync.verify_failed",
            message="remote state does not match local file",
            detail={"local_path": local_path.as_posix(), "remote_path": remote_path},
            source=ERROR_SOURCE,
        )


def _required_env(name: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    raise AppError(
        code="sync.missing_config",
        message="missing Fine remote sync configuration",
        detail={"env": name},
        source=ERROR_SOURCE,
    )


def _remote_parent_path(remote_path: str) -> str:
    parent = remote_path.rsplit("/", maxsplit=1)[0]
    return parent or "/"
