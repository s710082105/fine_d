from __future__ import annotations

from base64 import b64decode
from dataclasses import dataclass
from pathlib import Path

from .jvm import JvmBridgeConfig, JvmBridgeRunner


@dataclass(frozen=True)
class RemoteFileEntry:
    path: str
    is_directory: bool
    lock: str | None


class FineRemoteClient:
    def __init__(
        self,
        *,
        base_url: str,
        username: str,
        password: str,
        fine_home: Path,
        java_bin: str = "java",
        javac_bin: str = "javac",
    ) -> None:
        self._base_options = {
            "--url": base_url,
            "--username": username,
            "--password": password,
        }
        config = JvmBridgeConfig(fine_home=Path(fine_home), java_bin=java_bin, javac_bin=javac_bin)
        self._bridge = JvmBridgeRunner(config)

    def list_files(self, path: str) -> list[RemoteFileEntry]:
        payload = self._bridge.invoke("list", options=self._options(path))
        return [
            RemoteFileEntry(
                path=item["path"],
                is_directory=item["directory"],
                lock=item["lock"],
            )
            for item in payload["items"]
        ]

    def read_file(self, path: str) -> bytes:
        payload = self._bridge.invoke("read", options=self._options(path))
        return b64decode(payload["contentBase64"])

    def write_file(self, path: str, content: bytes) -> None:
        self._bridge.invoke("write", options=self._options(path), input_bytes=content)

    def delete_file(self, path: str) -> None:
        self._bridge.invoke("delete", options=self._options(path))

    def _options(self, path: str) -> dict[str, str]:
        return {
            **self._base_options,
            "--path": path,
        }
