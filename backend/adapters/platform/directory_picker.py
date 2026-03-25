from pathlib import Path

from backend.domain.project.errors import (
    directory_selection_cancelled_error,
    directory_selection_failed_error,
)


class SystemDirectoryPicker:
    def choose_directory(self) -> Path:
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
