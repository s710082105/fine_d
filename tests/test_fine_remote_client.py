from __future__ import annotations

import os
import unittest
from pathlib import Path

from fine_remote.client import FineRemoteClient, RemoteFileEntry


DEFAULT_URL = "http://localhost:8075/webroot/decision"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin"
DEFAULT_FINE_HOME = "/Applications/FineReport"
DEFAULT_ROOT_PATH = "reportlets"
READ_PATH_ENV = "FINE_REMOTE_READ_PATH"
WRITE_PATH_ENV = "FINE_REMOTE_WRITE_PATH"
WRITE_ENABLE_ENV = "FINE_REMOTE_ENABLE_WRITE_TEST"
EXPECTED_PATHS_ENV = "FINE_REMOTE_EXPECTED_PATHS"


def parse_expected_paths(raw_value: str | None) -> tuple[str, ...]:
    if raw_value is None:
        return ()
    paths = [item.strip() for item in raw_value.split(",")]
    return tuple(path for path in paths if path)


def select_read_path(
    entries: list[RemoteFileEntry],
    *,
    configured_path: str | None,
) -> str:
    if configured_path:
        return configured_path
    for entry in entries:
        if not entry.is_directory:
            return entry.path
    raise unittest.SkipTest(
        "remote reportlets path contains no readable file entries; "
        f"set {READ_PATH_ENV} to a readable file path"
    )


def resolve_write_path(
    *,
    enable_write_test: str | None,
    configured_path: str | None,
) -> str:
    if enable_write_test != "1":
        raise unittest.SkipTest(
            "remote write integration test is disabled by default; "
            f"set {WRITE_ENABLE_ENV}=1 and {WRITE_PATH_ENV}=<remote-file-path> to opt in"
        )
    if configured_path is None or not configured_path.strip():
        raise unittest.SkipTest(
            f"set {WRITE_PATH_ENV} to a writable remote file path before enabling write tests"
        )
    return configured_path.strip()


class FineRemoteClientIntegrationConfigTest(unittest.TestCase):
    def test_select_read_path_prefers_configured_path(self) -> None:
        entries = [
            RemoteFileEntry(path="reportlets/demo", is_directory=True, lock=None),
            RemoteFileEntry(
                path="reportlets/GettingStarted.cpt",
                is_directory=False,
                lock=None,
            ),
        ]

        selected_path = select_read_path(entries, configured_path="reportlets/custom.cpt")

        self.assertEqual(selected_path, "reportlets/custom.cpt")

    def test_select_read_path_falls_back_to_first_file(self) -> None:
        entries = [
            RemoteFileEntry(path="reportlets/demo", is_directory=True, lock=None),
            RemoteFileEntry(
                path="reportlets/GettingStarted.cpt",
                is_directory=False,
                lock=None,
            ),
        ]

        selected_path = select_read_path(entries, configured_path=None)

        self.assertEqual(selected_path, "reportlets/GettingStarted.cpt")

    def test_resolve_write_path_requires_opt_in(self) -> None:
        with self.assertRaisesRegex(unittest.SkipTest, "disabled by default"):
            resolve_write_path(enable_write_test=None, configured_path=None)

    def test_resolve_write_path_returns_configured_path(self) -> None:
        selected_path = resolve_write_path(
            enable_write_test="1",
            configured_path="reportlets/GettingStarted.cpt",
        )

        self.assertEqual(selected_path, "reportlets/GettingStarted.cpt")


class FineRemoteClientIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = FineRemoteClient(
            base_url=os.environ.get("FINE_REMOTE_URL", DEFAULT_URL),
            username=os.environ.get("FINE_REMOTE_USERNAME", DEFAULT_USERNAME),
            password=os.environ.get("FINE_REMOTE_PASSWORD", DEFAULT_PASSWORD),
            fine_home=Path(os.environ.get("FINE_REMOTE_HOME", DEFAULT_FINE_HOME)),
        )
        cls.root_path = os.environ.get("FINE_REMOTE_ROOT_PATH", DEFAULT_ROOT_PATH)
        cls.expected_paths = parse_expected_paths(os.environ.get(EXPECTED_PATHS_ENV))
        cls.entries = cls.client.list_files(cls.root_path)
        cls.read_path = select_read_path(
            cls.entries,
            configured_path=os.environ.get(READ_PATH_ENV),
        )

    def test_list_files_reads_reportlets(self) -> None:
        self.assertGreater(len(self.entries), 0)
        self.assertTrue(any(not entry.is_directory for entry in self.entries))

        paths = {entry.path for entry in self.entries}
        for expected_path in self.expected_paths:
            self.assertIn(expected_path, paths)

    def test_read_file_downloads_remote_template(self) -> None:
        content = self.client.read_file(self.read_path)

        self.assertGreater(len(content), 0)

    def test_write_file_roundtrips_existing_template(self) -> None:
        write_path = resolve_write_path(
            enable_write_test=os.environ.get(WRITE_ENABLE_ENV),
            configured_path=os.environ.get(WRITE_PATH_ENV),
        )
        original = self.client.read_file(write_path)
        self.assertGreater(len(original), 0)

        self.client.write_file(write_path, original)
        current = self.client.read_file(write_path)

        self.assertEqual(current, original)
