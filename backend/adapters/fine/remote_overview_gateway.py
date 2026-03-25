import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Callable, TypeVar

from backend.adapters.fine.http_client import FineHttpClient
from backend.domain.project.errors import AppError
from backend.domain.project.models import CurrentProject
from backend.domain.project.remote_models import RemoteProfile
from backend.domain.remote.models import (
    RemoteDirectoryEntry,
    RemoteOverview,
    RemoteProfileTestResult,
)

DEFAULT_REMOTE_ROOT = "reportlets"
REMOTE_HOME_ENV = "FINE_REMOTE_HOME"
ERROR_SOURCE = "remote"
T = TypeVar("T")


class FineRemoteOverviewGateway:
    def __init__(
        self,
        remote_root: str = DEFAULT_REMOTE_ROOT,
        fine_home: Path | None = None,
    ) -> None:
        self._remote_root = remote_root.strip("/\\") or DEFAULT_REMOTE_ROOT
        self._fine_home = None if fine_home is None else Path(fine_home)

    def load_overview(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteOverview:
        directory_entries = self._list_directory_entries(profile, current_project)
        data_connections = self._list_data_connections(profile)
        return RemoteOverview(
            directory_entries=directory_entries,
            data_connections=data_connections,
            last_loaded_at=datetime.now(UTC),
        )

    def test_connection(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> RemoteProfileTestResult:
        self.load_overview(profile, current_project)
        return RemoteProfileTestResult(status="ok", message="连接成功")

    def _list_directory_entries(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ) -> list[RemoteDirectoryEntry]:
        def load_entries() -> list[RemoteDirectoryEntry]:
            client = self._build_remote_client(profile, current_project)
            entries = client.list_files(self._remote_root)
            return [
                RemoteDirectoryEntry(
                    path=entry.path,
                    is_directory=entry.is_directory,
                    lock=entry.lock,
                )
                for entry in entries
            ]

        return _run_remote_operation("directory_entries", load_entries)

    @staticmethod
    def _list_data_connections(profile: RemoteProfile) -> list:
        def load_connections() -> list:
            client = FineHttpClient(
                base_url=profile.base_url,
                username=profile.username,
                password=profile.password,
            )
            return client.list_connections()

        return _run_remote_operation("data_connections", load_connections)

    def _build_remote_client(
        self,
        profile: RemoteProfile,
        current_project: CurrentProject,
    ):
        from fine_remote.client import FineRemoteClient

        return FineRemoteClient(
            base_url=profile.base_url,
            username=profile.username,
            password=profile.password,
            fine_home=_resolve_fine_home(current_project, self._fine_home),
        )


def _remote_request_failed_error(operation: str, error: Exception) -> AppError:
    return AppError(
        code="remote.request_failed",
        message="远程请求失败",
        detail={"operation": operation, "reason": str(error)},
        source=ERROR_SOURCE,
        retryable=True,
    )


def _run_remote_operation(operation: str, action: Callable[[], T]) -> T:
    try:
        return action()
    except AppError:
        raise
    except Exception as error:
        raise _remote_request_failed_error(operation, error) from error


def _resolve_fine_home(
    current_project: CurrentProject,
    configured_path: Path | None,
) -> Path:
    if configured_path is not None:
        fine_home = configured_path.expanduser().resolve()
    else:
        fine_home = _load_fine_home_from_env()
    if _has_runtime_jars(fine_home):
        return fine_home
    raise AppError(
        code="remote.runtime_invalid",
        message="FineReport 运行时目录无效",
        detail={
            "path": str(fine_home),
            "project_path": str(current_project.path),
        },
        source=ERROR_SOURCE,
    )


def _load_fine_home_from_env() -> Path:
    value = os.environ.get(REMOTE_HOME_ENV, "").strip()
    if value:
        return Path(value).expanduser().resolve()
    raise AppError(
        code="remote.runtime_missing",
        message="缺少 FineReport 运行时目录配置",
        detail={"env": REMOTE_HOME_ENV},
        source=ERROR_SOURCE,
    )


def _has_runtime_jars(fine_home: Path) -> bool:
    jar_directories = (
        fine_home / "webapps" / "webroot" / "WEB-INF" / "lib",
        fine_home / "lib",
    )
    return any(directory.exists() and any(directory.glob("*.jar")) for directory in jar_directories)
