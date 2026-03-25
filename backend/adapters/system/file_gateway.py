import base64
import binascii
from pathlib import Path

from backend.domain.project.errors import AppError
from backend.domain.reportlet.models import ReportletEncoding, ReportletEntry, ReportletFile

INVALID_PATH_CODE = "reportlet.invalid_path"
MISSING_FILE_CODE = "reportlet.not_found"
INVALID_FILE_CODE = "reportlet.invalid_file"
INVALID_CONTENT_CODE = "reportlet.invalid_content"
ERROR_SOURCE = "reportlet"
TEXT_ENCODING = "utf-8"
BINARY_ENCODING = "base64"


class FileGateway:
    def __init__(self, root: Path) -> None:
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)
        self._root_resolved = self._root.resolve()

    def list_tree(self) -> list[ReportletEntry]:
        return self._read_directory(self._root_resolved)

    def read(self, path: Path) -> ReportletFile:
        target = self._resolve_file_path(path)
        self._ensure_existing_file(target, path)
        return self._build_file(target)

    def write(
        self,
        path: Path,
        content: str,
        encoding: ReportletEncoding = TEXT_ENCODING,
    ) -> ReportletFile:
        target = self._resolve_file_path(path)
        self._ensure_target_is_file_path(target, path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(self._decode_content(content, encoding, path))
        return self._build_file(target)

    def copy(self, source: Path, target: Path) -> ReportletFile:
        source_path = self._resolve_file_path(source)
        self._ensure_existing_file(source_path, source)
        target_path = self._resolve_file_path(target)
        self._ensure_target_is_file_path(target_path, target)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(source_path.read_bytes())
        return self._build_file(target_path)

    def create_from_template(self, target: Path, template: Path) -> ReportletFile:
        template_path = self._resolve_file_path(template)
        self._ensure_existing_file(template_path, template)
        target_path = self._resolve_file_path(target)
        self._ensure_target_is_file_path(target_path, target)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(template_path.read_bytes())
        return self.read(target)

    def _read_directory(self, directory: Path) -> list[ReportletEntry]:
        entries = [entry for entry in directory.iterdir() if not entry.name.startswith(".")]
        entries.sort(key=lambda entry: entry.name)
        return [self._build_entry(entry) for entry in entries]

    def _build_entry(self, entry: Path) -> ReportletEntry:
        relative_path = entry.relative_to(self._root_resolved).as_posix()
        if entry.is_dir():
            return ReportletEntry(
                name=entry.name,
                path=relative_path,
                kind="directory",
                children=self._read_directory(entry),
            )
        return ReportletEntry(
            name=entry.name,
            path=relative_path,
            kind="file",
            children=[],
        )

    def _build_file(self, path: Path) -> ReportletFile:
        content = path.read_bytes()
        encoded_content, encoding = self._encode_content(content)
        return ReportletFile(
            name=path.name,
            path=path.relative_to(self._root_resolved).as_posix(),
            content=encoded_content,
            encoding=encoding,
        )

    def _resolve_file_path(self, path: Path) -> Path:
        relative_path = Path(path)
        if str(relative_path).strip() in {"", "."}:
            raise self._invalid_path(relative_path)
        if relative_path.is_absolute():
            raise self._invalid_path(relative_path)
        if any(part == ".." for part in relative_path.parts):
            raise self._invalid_path(relative_path)
        resolved_path = (self._root_resolved / relative_path).resolve(strict=False)
        try:
            resolved_path.relative_to(self._root_resolved)
        except ValueError as exc:
            raise self._invalid_path(relative_path) from exc
        return resolved_path

    def _ensure_existing_file(self, resolved_path: Path, original_path: Path) -> None:
        if not resolved_path.exists():
            raise AppError(
                code=MISSING_FILE_CODE,
                message="reportlet file does not exist",
                detail={"path": original_path.as_posix()},
                source=ERROR_SOURCE,
            )
        if not resolved_path.is_file():
            raise AppError(
                code=INVALID_FILE_CODE,
                message="reportlet path must point to a file",
                detail={"path": original_path.as_posix()},
                source=ERROR_SOURCE,
            )

    def _ensure_target_is_file_path(self, resolved_path: Path, original_path: Path) -> None:
        if resolved_path.exists() and not resolved_path.is_file():
            raise AppError(
                code=INVALID_FILE_CODE,
                message="reportlet path must point to a file",
                detail={"path": original_path.as_posix()},
                source=ERROR_SOURCE,
            )

    def _encode_content(self, content: bytes) -> tuple[str, ReportletEncoding]:
        try:
            return content.decode(TEXT_ENCODING), TEXT_ENCODING
        except UnicodeDecodeError:
            encoded = base64.b64encode(content).decode("ascii")
            return encoded, BINARY_ENCODING

    def _decode_content(
        self,
        content: str,
        encoding: ReportletEncoding,
        path: Path,
    ) -> bytes:
        if encoding == TEXT_ENCODING:
            return content.encode(TEXT_ENCODING)
        if encoding == BINARY_ENCODING:
            try:
                return base64.b64decode(content, validate=True)
            except binascii.Error as exc:
                raise AppError(
                    code=INVALID_CONTENT_CODE,
                    message="reportlet content is not valid base64",
                    detail={"path": path.as_posix(), "encoding": encoding},
                    source=ERROR_SOURCE,
                ) from exc
        raise AppError(
            code=INVALID_CONTENT_CODE,
            message="reportlet encoding is not supported",
            detail={"path": path.as_posix(), "encoding": encoding},
            source=ERROR_SOURCE,
        )

    def _invalid_path(self, path: Path) -> AppError:
        return AppError(
            code=INVALID_PATH_CODE,
            message="reportlet path must stay inside reportlets",
            detail={"path": path.as_posix()},
            source=ERROR_SOURCE,
        )
