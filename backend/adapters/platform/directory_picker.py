import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from backend.domain.project.errors import (
    directory_selection_cancelled_error,
    directory_selection_failed_error,
)

CommandRunner = Callable[[list[str]], subprocess.CompletedProcess[str]]

MACOS_CHOOSE_FOLDER_COMMAND = [
    "/usr/bin/osascript",
    "-e",
    'set selectedFolder to POSIX path of (choose folder with prompt "请选择项目目录")',
    "-e",
    "return selectedFolder",
]
MACOS_CANCEL_MARKERS = ("-128", "cancel", "取消")


def _run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )


class SystemDirectoryPicker:
    def __init__(
        self,
        platform: str | None = None,
        command_runner: CommandRunner = _run_command,
    ) -> None:
        self._platform = platform or sys.platform
        self._command_runner = command_runner

    def choose_directory(self) -> Path:
        if self._platform == "darwin":
            return self._choose_directory_with_osascript()
        return self._choose_directory_with_tk()

    def _choose_directory_with_osascript(self) -> Path:
        try:
            result = self._command_runner(MACOS_CHOOSE_FOLDER_COMMAND)
        except Exception as exc:  # pragma: no cover - depends on local GUI runtime
            raise directory_selection_failed_error(str(exc)) from exc
        if result.returncode != 0:
            self._raise_macos_dialog_error(result.stderr.strip())
        selected = result.stdout.strip()
        if not selected:
            raise directory_selection_cancelled_error()
        return Path(selected).expanduser().resolve()

    def _choose_directory_with_tk(self) -> Path:
        try:
            import tkinter as tk
            from tkinter import filedialog
        except Exception as exc:  # pragma: no cover - depends on local GUI runtime
            raise directory_selection_failed_error(str(exc)) from exc

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        try:
            selected = filedialog.askdirectory(mustexist=True)
        finally:
            root.destroy()

        if not selected:
            raise directory_selection_cancelled_error()
        return Path(selected).expanduser().resolve()

    def _raise_macos_dialog_error(self, message: str) -> None:
        lowered = message.lower()
        if any(marker in lowered for marker in MACOS_CANCEL_MARKERS):
            raise directory_selection_cancelled_error()
        reason = message or "osascript exited with non-zero status"
        raise directory_selection_failed_error(reason)
