from dataclasses import dataclass
from typing import Literal

ReportletKind = Literal["file", "directory"]
ReportletEncoding = Literal["utf-8", "base64"]


@dataclass(frozen=True, slots=True)
class ReportletEntry:
    name: str
    path: str
    kind: ReportletKind
    children: list["ReportletEntry"]


@dataclass(frozen=True, slots=True)
class ReportletFile:
    name: str
    path: str
    content: str
    encoding: ReportletEncoding
