from dataclasses import dataclass
from datetime import datetime

from backend.domain.datasource.models import ConnectionSummary


@dataclass(frozen=True, slots=True)
class RemoteDirectoryEntry:
    name: str
    path: str
    is_directory: bool
    lock: str | None


@dataclass(frozen=True, slots=True)
class RemoteOverview:
    directory_entries: list[RemoteDirectoryEntry]
    data_connections: list[ConnectionSummary]
    last_loaded_at: datetime


@dataclass(frozen=True, slots=True)
class RemoteProfileTestResult:
    status: str
    message: str
