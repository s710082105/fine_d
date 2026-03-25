from datetime import UTC, datetime

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
ERROR_SOURCE = "remote"


class FineRemoteOverviewGateway:
    def __init__(self, remote_root: str = DEFAULT_REMOTE_ROOT) -> None:
        self._remote_root = remote_root.strip("/\\") or DEFAULT_REMOTE_ROOT

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

    @staticmethod
    def _build_remote_client(
        profile: RemoteProfile,
        current_project: CurrentProject,
    ):
        from fine_remote.client import FineRemoteClient

        return FineRemoteClient(
            base_url=profile.base_url,
            username=profile.username,
            password=profile.password,
            fine_home=current_project.path,
        )


def _remote_request_failed_error(operation: str, error: Exception) -> AppError:
    return AppError(
        code="remote.request_failed",
        message="远程请求失败",
        detail={"operation": operation, "reason": str(error)},
        source=ERROR_SOURCE,
        retryable=True,
    )


def _run_remote_operation(operation: str, action):
    try:
        return action()
    except AppError:
        raise
    except Exception as error:
        raise _remote_request_failed_error(operation, error) from error
