from backend.domain.project.errors import AppError
from backend.domain.sync.models import SyncStatus

ALLOWED_TRANSITIONS: dict[SyncStatus, set[SyncStatus]] = {
    "pending": {"syncing"},
    "syncing": {"verified"},
    "verified": set(),
}


class SyncStateMachine:
    def __init__(self, status: SyncStatus = "pending") -> None:
        self._status = status

    @property
    def status(self) -> SyncStatus:
        return self._status

    def transition(
        self,
        current: SyncStatus,
        target: SyncStatus,
    ) -> SyncStatus:
        if current != self._status:
            raise AppError(
                code="sync.invalid_transition",
                message="sync state does not match current transition source",
                detail={"expected": self._status, "current": current, "target": target},
                source="sync",
            )
        if target not in ALLOWED_TRANSITIONS[current]:
            raise AppError(
                code="sync.invalid_transition",
                message="sync state transition is not allowed",
                detail={"current": current, "target": target},
                source="sync",
            )
        self._status = target
        return self._status
