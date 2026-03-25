from datetime import datetime

from pydantic import BaseModel, ConfigDict

from backend.domain.remote.models import (
    RemoteDirectoryEntry,
    RemoteOverview,
    RemoteProfileTestResult,
)
from backend.schemas.datasource import ConnectionSummaryResponse


class RemoteDirectoryEntryResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    path: str
    is_directory: bool
    lock: str | None

    @classmethod
    def from_domain(cls, item: RemoteDirectoryEntry) -> "RemoteDirectoryEntryResponse":
        return cls(
            path=item.path,
            is_directory=item.is_directory,
            lock=item.lock,
        )


class RemoteOverviewResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    directory_entries: list[RemoteDirectoryEntryResponse]
    data_connections: list[ConnectionSummaryResponse]
    last_loaded_at: datetime

    @classmethod
    def from_domain(cls, overview: RemoteOverview) -> "RemoteOverviewResponse":
        return cls(
            directory_entries=[
                RemoteDirectoryEntryResponse.from_domain(item)
                for item in overview.directory_entries
            ],
            data_connections=[
                ConnectionSummaryResponse.from_domain(item)
                for item in overview.data_connections
            ],
            last_loaded_at=overview.last_loaded_at,
        )


class RemoteProfileTestResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    status: str
    message: str

    @classmethod
    def from_domain(
        cls,
        result: RemoteProfileTestResult,
    ) -> "RemoteProfileTestResponse":
        return cls(status=result.status, message=result.message)
