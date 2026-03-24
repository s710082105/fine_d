from pathlib import Path
from typing import Protocol

from backend.domain.reportlet.models import (
    ReportletEncoding,
    ReportletEntry,
    ReportletFile,
)


class ReportletGateway(Protocol):
    def list_tree(self) -> list[ReportletEntry]:
        ...

    def read(self, path: Path) -> ReportletFile:
        ...

    def write(
        self,
        path: Path,
        content: str,
        encoding: ReportletEncoding = "utf-8",
    ) -> ReportletFile:
        ...

    def copy(self, source: Path, target: Path) -> ReportletFile:
        ...

    def create_from_template(self, target: Path, template: Path) -> ReportletFile:
        ...


class ReportletUseCases:
    def __init__(self, gateway: ReportletGateway) -> None:
        self._gateway = gateway

    def list_tree(self) -> list[ReportletEntry]:
        return self._gateway.list_tree()

    def read(self, path: Path) -> ReportletFile:
        return self._gateway.read(path)

    def write(
        self,
        path: Path,
        content: str,
        encoding: ReportletEncoding = "utf-8",
    ) -> ReportletFile:
        return self._gateway.write(path, content, encoding)

    def copy(self, source: Path, target: Path) -> ReportletFile:
        return self._gateway.copy(source, target)

    def create_from_template(self, target: Path, template: Path) -> ReportletFile:
        return self._gateway.create_from_template(target, template)
