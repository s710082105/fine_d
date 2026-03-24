from typing import Callable, Protocol

from backend.domain.project.errors import AppError
from backend.domain.sync.models import SyncAction, SyncResult
from backend.domain.sync.state_machine import SyncStateMachine

SYNC_ALLOWED_ACTIONS = {
    "sync_file",
    "sync_directory",
    "pull_remote_file",
    "publish_project",
    "verify_remote_state",
}


class SyncGateway(Protocol):
    def sync_file(self, path: str) -> None:
        ...

    def sync_directory(self, path: str | None = None) -> None:
        ...

    def pull_remote_file(self, path: str) -> None:
        ...

    def verify_remote_state(self, path: str | None = None) -> None:
        ...


class SyncUseCases:
    def __init__(self, gateway: SyncGateway) -> None:
        self._gateway = gateway

    def dispatch(
        self,
        action: str,
        target_path: str | None = None,
    ) -> SyncResult:
        resolved_action = self._validate_action(action)
        if resolved_action == "publish_project":
            return self.publish_project()
        return self._execute_action(resolved_action, target_path)

    def sync_file(self, path: str) -> SyncResult:
        return self.dispatch("sync_file", target_path=path)

    def sync_directory(self, path: str | None = None) -> SyncResult:
        return self.dispatch("sync_directory", target_path=path)

    def pull_remote_file(self, path: str) -> SyncResult:
        return self.dispatch("pull_remote_file", target_path=path)

    def publish_project(self) -> SyncResult:
        directory_result = self.dispatch("sync_directory")
        verify_result = self.dispatch("verify_remote_state")
        return SyncResult(
            action="publish_project",
            status=verify_result.status,
            target_path=directory_result.target_path,
            remote_path=verify_result.remote_path,
        )

    def verify_remote_state(self, path: str | None = None) -> SyncResult:
        return self.dispatch("verify_remote_state", target_path=path)

    def _execute_action(
        self,
        action: SyncAction,
        target_path: str | None,
    ) -> SyncResult:
        machine = SyncStateMachine()
        machine.transition("pending", "syncing")
        operation = self._resolve_operation(action, target_path)
        operation()
        status = machine.transition("syncing", "verified")
        return SyncResult(
            action=action,
            status=status,
            target_path=target_path,
            remote_path=target_path,
        )

    def _resolve_operation(
        self,
        action: SyncAction,
        target_path: str | None,
    ) -> Callable[[], None]:
        if action == "sync_file":
            path = self._require_target_path(action, target_path)
            return lambda: self._gateway.sync_file(path)
        if action == "sync_directory":
            return lambda: self._gateway.sync_directory(target_path)
        if action == "pull_remote_file":
            path = self._require_target_path(action, target_path)
            return lambda: self._gateway.pull_remote_file(path)
        return lambda: self._gateway.verify_remote_state(target_path)

    @staticmethod
    def _require_target_path(action: SyncAction, target_path: str | None) -> str:
        if target_path:
            return target_path
        raise AppError(
            code="sync.missing_target_path",
            message="sync action requires a target path",
            detail={"action": action},
            source="sync",
        )

    @staticmethod
    def _validate_action(action: str) -> SyncAction:
        if action in SYNC_ALLOWED_ACTIONS:
            return action
        raise AppError(
            code="sync.invalid_action",
            message="unsupported sync action",
            detail={"action": action, "allowed_actions": sorted(SYNC_ALLOWED_ACTIONS)},
            source="sync",
        )
