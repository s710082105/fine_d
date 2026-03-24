import pytest

from backend.application.sync.use_cases import SYNC_ALLOWED_ACTIONS, SyncUseCases
from backend.domain.project.errors import AppError
from backend.domain.sync.models import SYNC_STATUSES
from backend.domain.sync.state_machine import SyncStateMachine


class FakeSyncGateway:
    def __init__(self, fail_on: str | None = None) -> None:
        self.operations: list[str] = []
        self._fail_on = fail_on

    def _record(self, operation: str) -> None:
        self.operations.append(operation)
        if operation == self._fail_on:
            raise AppError(
                code="sync.gateway_failed",
                message="gateway execution failed",
                detail={"operation": operation},
                source="sync",
            )

    def sync_file(self, path: str) -> None:
        self._record("sync_file")

    def sync_directory(self, path: str) -> None:
        self._record("sync_directory")

    def pull_remote_file(self, path: str) -> None:
        self._record("pull_remote_file")

    def verify_remote_state(self, path: str | None = None) -> None:
        self._record("verify_remote_state")


@pytest.fixture
def fake_sync_gateway() -> FakeSyncGateway:
    return FakeSyncGateway()


def test_sync_statuses_match_design_spec() -> None:
    assert SYNC_STATUSES == (
        "pending",
        "running",
        "success",
        "failed",
        "verified",
    )


def test_sync_file_transitions_to_verified(fake_sync_gateway: FakeSyncGateway) -> None:
    use_case = SyncUseCases(fake_sync_gateway)

    result = use_case.sync_file("demo.cpt")

    assert result.status == "verified"
    assert fake_sync_gateway.operations == ["sync_file"]


def test_publish_project_uses_single_entrypoint(
    fake_sync_gateway: FakeSyncGateway,
) -> None:
    use_case = SyncUseCases(fake_sync_gateway)

    result = use_case.publish_project()

    assert result.status == "verified"
    assert fake_sync_gateway.operations == ["sync_directory", "verify_remote_state"]


def test_state_machine_accepts_success_path() -> None:
    machine = SyncStateMachine()

    assert machine.transition("pending", "running") == "running"
    assert machine.transition("running", "success") == "success"
    assert machine.transition("success", "verified") == "verified"


def test_sync_file_failure_transitions_to_failed() -> None:
    use_case = SyncUseCases(FakeSyncGateway(fail_on="sync_file"))

    with pytest.raises(AppError) as exc_info:
        use_case.sync_file("demo.cpt")

    assert exc_info.value.code == "sync.gateway_failed"
    assert exc_info.value.detail == {
        "operation": "sync_file",
        "status": "failed",
    }


def test_dispatch_rejects_unsupported_action(
    fake_sync_gateway: FakeSyncGateway,
) -> None:
    use_case = SyncUseCases(fake_sync_gateway)

    with pytest.raises(AppError) as exc_info:
        use_case.dispatch("invalid_action", target_path="demo.cpt")

    assert exc_info.value.code == "sync.invalid_action"
    assert set(SYNC_ALLOWED_ACTIONS) == {
        "sync_file",
        "sync_directory",
        "pull_remote_file",
        "publish_project",
        "verify_remote_state",
    }


def test_state_machine_rejects_invalid_transition() -> None:
    machine = SyncStateMachine()

    with pytest.raises(AppError) as exc_info:
        machine.transition("pending", "verified")

    assert exc_info.value.code == "sync.invalid_transition"


def test_state_machine_allows_failure_terminal_state() -> None:
    machine = SyncStateMachine()

    assert machine.transition("pending", "running") == "running"
    assert machine.transition("running", "failed") == "failed"
