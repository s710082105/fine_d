"""Build bridge invocation commands and execute bridge operations."""

from __future__ import annotations

import base64
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


class BridgeError(RuntimeError):
    """Raised when the Java bridge fails."""


@dataclass(frozen=True)
class ProcessResult:
    returncode: int
    stdout: str
    stderr: str


RunProcess = Callable[[list[str], str], ProcessResult]


def build_bridge_command(java_path: Path, jar_path: Path, operation: str) -> list[str]:
    return [str(java_path), "-jar", str(jar_path), operation]


def default_run_process(command: list[str], payload: str) -> ProcessResult:
    result = subprocess.run(
        command,
        input=payload,
        capture_output=True,
        check=False,
        text=True,
    )
    return ProcessResult(result.returncode, result.stdout, result.stderr)


@dataclass(frozen=True)
class BridgeRunner:
    java_path: Path
    jar_path: Path
    run_process: RunProcess = default_run_process

    def invoke(self, operation: str, payload: dict[str, object]) -> dict[str, object]:
        command = build_bridge_command(self.java_path, self.jar_path, operation)
        result = self.run_process(command, _encode_payload(payload))
        raw = result.stdout.strip() or result.stderr.strip()
        if not raw:
            raise BridgeError("bridge returned no output")
        try:
            response = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise BridgeError(raw) from exc
        if result.returncode != 0 or response.get("status") == "error":
            message = response.get("message") or raw
            raise BridgeError(str(message))
        return response


@dataclass(frozen=True)
class ConfiguredBridgeRunner:
    runner: BridgeRunner
    fine_home: Path
    base_url: str
    username: str
    password: str

    def invoke(self, operation: str, payload: dict[str, object]) -> dict[str, object]:
        request_payload = {
            "fineHome": str(self.fine_home),
            "baseUrl": self.base_url,
            "username": self.username,
            "password": self.password,
            **payload,
        }
        return self.runner.invoke(operation, request_payload)


def _encode_payload(payload: dict[str, object]) -> str:
    lines: list[str] = []
    for key, value in payload.items():
        if value is None:
            continue
        text = _stringify(value)
        encoded = base64.b64encode(text.encode("utf-8")).decode("ascii")
        lines.append(f"{key}={encoded}")
    return "\n".join(lines)


def _stringify(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)
