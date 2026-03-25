from typing import Literal

from pydantic import BaseModel, ConfigDict

from backend.domain.reportlet.models import (
    ReportletEncoding,
    ReportletEntry,
    ReportletFile,
)


class ReportletEntryResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    path: str
    kind: Literal["file", "directory"]
    children: list["ReportletEntryResponse"]

    @classmethod
    def from_domain(cls, item: ReportletEntry) -> "ReportletEntryResponse":
        return cls(
            name=item.name,
            path=item.path,
            kind=item.kind,
            children=[cls.from_domain(child) for child in item.children],
        )


class ReportletFileResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    path: str
    content: str
    encoding: ReportletEncoding

    @classmethod
    def from_domain(cls, item: ReportletFile) -> "ReportletFileResponse":
        return cls(
            name=item.name,
            path=item.path,
            content=item.content,
            encoding=item.encoding,
        )


class ReportletWriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    content: str
    encoding: ReportletEncoding = "utf-8"


class ReportletCopyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_path: str
    target_path: str


class ReportletCreateFromTemplateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_path: str
    template_path: str


ReportletEntryResponse.model_rebuild()
