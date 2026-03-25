from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ConnectionSummary:
    name: str
    database_type: str = ""
    host_or_url: str = ""


@dataclass(frozen=True, slots=True)
class SqlPreviewResult:
    columns: list[str]
    rows: list[list[Any]]
