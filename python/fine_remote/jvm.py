from __future__ import annotations

import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


BRIDGE_CLASS = "fine_remote.FrRemoteBridge"
CLASSPATH_SEPARATOR = os.pathsep
WINDOWS_EXECUTABLE_SUFFIX = ".exe"
REQUIRED_BRIDGE_FILES = (
    "FrRemoteBridge.class",
    "FrRemoteBridge$Arguments.class",
)


@dataclass(frozen=True)
class JvmBridgeConfig:
    fine_home: Path
    java_bin: str = "java"


class JvmBridgeRunner:
    def __init__(self, config: JvmBridgeConfig) -> None:
        self._config = config
        self._repo_root = Path(__file__).resolve().parents[2]
        self._class_root = self._repo_root / "java"
        self._bridge_dir = self._class_root / "fine_remote"

    def invoke(
        self,
        command: str,
        *,
        options: dict[str, str],
        input_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        self._ensure_bridge_class()
        with tempfile.NamedTemporaryFile(
            dir=self._repo_root, suffix=".json", delete=False
        ) as output_file:
            output_path = Path(output_file.name)
        input_path = self._write_input_file(input_bytes)
        try:
            arguments = self._build_java_command(command, options, output_path, input_path)
            completed = run_subprocess(arguments, cwd=self._repo_root)
            if completed.returncode != 0:
                details = completed.stderr.strip() or completed.stdout.strip()
                raise RuntimeError(details or f"Bridge exited with code {completed.returncode}")
            if not output_path.exists():
                raise RuntimeError("Bridge did not produce an output file")
            return read_json(output_path)
        finally:
            delete_if_exists(input_path)
            delete_if_exists(output_path)

    def _ensure_bridge_class(self) -> None:
        for file_name in REQUIRED_BRIDGE_FILES:
            class_file = self._bridge_dir / file_name
            if not class_file.exists():
                raise RuntimeError(f"Embedded bridge class is missing: {class_file}")

    def _build_java_command(
        self,
        command: str,
        options: dict[str, str],
        output_path: Path,
        input_path: Path | None,
    ) -> list[str]:
        arguments = [
            self._config.java_bin,
            "-cp",
            f"{self._class_root}{CLASSPATH_SEPARATOR}{self._classpath()}",
            BRIDGE_CLASS,
            command,
        ]
        for key, value in options.items():
            arguments.extend([key, value])
        if input_path is not None:
            arguments.extend(["--input-file", str(input_path)])
        arguments.extend(["--output-file", str(output_path)])
        return arguments

    def _classpath(self) -> str:
        jars = list(
            self._collect_jars(
                self._config.fine_home / "webapps" / "webroot" / "WEB-INF" / "lib"
            )
        )
        jars.extend(self._collect_jars(self._config.fine_home / "lib"))
        if not jars:
            raise FileNotFoundError(f"No FineReport jars found under {self._config.fine_home}")
        return CLASSPATH_SEPARATOR.join(jars)

    def _collect_jars(self, directory: Path) -> list[str]:
        if not directory.exists():
            return []
        return [str(path) for path in sorted(directory.glob("*.jar"))]

    def _write_input_file(self, input_bytes: bytes | None) -> Path | None:
        if input_bytes is None:
            return None
        with tempfile.NamedTemporaryFile(
            dir=self._repo_root, suffix=".bin", delete=False
        ) as input_file:
            input_file.write(input_bytes)
            return Path(input_file.name)


def resolve_jvm_command(fine_home: Path, default_command: str) -> str:
    executable_names = command_candidates(default_command)
    for candidate in bundled_command_candidates(fine_home, executable_names):
        if candidate.exists():
            return str(candidate)
    return default_command


def command_candidates(command: str) -> tuple[str, ...]:
    if command.endswith(WINDOWS_EXECUTABLE_SUFFIX):
        return (command,)
    return (command, f"{command}{WINDOWS_EXECUTABLE_SUFFIX}")


def bundled_command_candidates(
    fine_home: Path, executable_names: tuple[str, ...]
) -> list[Path]:
    candidates: list[Path] = []
    for relative_dir in (("bin",), ("jre", "bin"), ("jdk", "bin"), ("java", "bin")):
        directory = fine_home.joinpath(*relative_dir)
        for executable_name in executable_names:
            candidates.append(directory / executable_name)
    return candidates


def run_subprocess(arguments: list[str], *, cwd: Path) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            arguments,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as error:
        raise RuntimeError(f"required executable not found: {arguments[0]}") from error


def read_json(path: Path) -> dict[str, Any]:
    import json

    return json.loads(path.read_text(encoding="utf-8"))


def delete_if_exists(path: Path | None) -> None:
    if path is not None and path.exists():
        path.unlink()
