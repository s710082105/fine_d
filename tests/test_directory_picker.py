import subprocess
from pathlib import Path

import pytest

from backend.adapters.platform.directory_picker import SystemDirectoryPicker
from backend.domain.project.errors import AppError


def test_choose_directory_uses_osascript_on_macos(tmp_path: Path) -> None:
    expected_path = tmp_path / "project-alpha"
    expected_path.mkdir()
    commands: list[list[str]] = []

    def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
        commands.append(command)
        return subprocess.CompletedProcess(
            args=command,
            returncode=0,
            stdout=f"{expected_path}\n",
            stderr="",
        )

    picker = SystemDirectoryPicker(platform="darwin", command_runner=runner)

    selected = picker.choose_directory()

    assert selected == expected_path.resolve()
    assert commands == [
        [
            "/usr/bin/osascript",
            "-e",
            'set selectedFolder to POSIX path of (choose folder with prompt "请选择项目目录")',
            "-e",
            "return selectedFolder",
        ]
    ]


def test_choose_directory_maps_macos_cancel_to_app_error() -> None:
    def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            args=command,
            returncode=1,
            stdout="",
            stderr="execution error: User canceled. (-128)",
        )

    picker = SystemDirectoryPicker(platform="darwin", command_runner=runner)

    with pytest.raises(AppError) as error:
        picker.choose_directory()

    assert error.value.code == "project.directory_selection_cancelled"


def test_choose_directory_surfaces_macos_command_failure() -> None:
    def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            args=command,
            returncode=1,
            stdout="",
            stderr="execution error: Not authorized.",
        )

    picker = SystemDirectoryPicker(platform="darwin", command_runner=runner)

    with pytest.raises(AppError) as error:
        picker.choose_directory()

    assert error.value.code == "project.directory_selection_failed"
    assert error.value.detail == {"reason": "execution error: Not authorized."}
