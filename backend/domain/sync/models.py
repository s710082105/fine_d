from dataclasses import dataclass
from typing import Literal

SYNC_STATUSES = (
    "pending",
    "running",
    "success",
    "failed",
    "verified",
)

SyncAction = Literal[
    "sync_file",
    "sync_directory",
    "pull_remote_file",
    "publish_project",
    "verify_remote_state",
]
SyncStatus = Literal["pending", "running", "success", "failed", "verified"]


@dataclass(frozen=True, slots=True)
class SyncResult:
    action: SyncAction
    status: SyncStatus
    target_path: str | None = None
    remote_path: str | None = None
