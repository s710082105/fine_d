from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ConnectionSummary:
    name: str


@dataclass(frozen=True, slots=True)
class SqlPreviewResult:
    columns: list[str]
    rows: list[list[Any]]
