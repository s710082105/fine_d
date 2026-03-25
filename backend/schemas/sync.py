from pydantic import BaseModel, ConfigDict

from backend.domain.sync.models import SyncAction, SyncResult, SyncStatus


class SyncActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: SyncAction
    target_path: str | None = None


class SyncResultResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    action: SyncAction
    status: SyncStatus
    target_path: str | None = None
    remote_path: str | None = None

    @classmethod
    def from_domain(cls, result: SyncResult) -> "SyncResultResponse":
        return cls(
            action=result.action,
            status=result.status,
            target_path=result.target_path,
            remote_path=result.remote_path,
        )
