from __future__ import annotations

import os
import unittest
from pathlib import Path

from fine_remote.client import FineRemoteClient


DEFAULT_URL = "http://localhost:8075/webroot/decision"
DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin"
DEFAULT_FINE_HOME = "/Applications/FineReport"
ROUNDTRIP_PATH = "reportlets/微信用户列表.cpt"


class FineRemoteClientIntegrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = FineRemoteClient(
            base_url=os.environ.get("FINE_REMOTE_URL", DEFAULT_URL),
            username=os.environ.get("FINE_REMOTE_USERNAME", DEFAULT_USERNAME),
            password=os.environ.get("FINE_REMOTE_PASSWORD", DEFAULT_PASSWORD),
            fine_home=Path(os.environ.get("FINE_REMOTE_HOME", DEFAULT_FINE_HOME)),
        )

    def test_list_files_reads_reportlets(self) -> None:
        entries = self.client.list_files("reportlets")
        paths = {entry.path for entry in entries}

        self.assertIn("reportlets/微信用户列表.cpt", paths)
        self.assertIn("reportlets/订单列表.cpt", paths)

    def test_read_file_downloads_remote_template(self) -> None:
        content = self.client.read_file(ROUNDTRIP_PATH)

        self.assertGreater(len(content), 0)

    def test_write_file_roundtrips_existing_template(self) -> None:
        original = self.client.read_file(ROUNDTRIP_PATH)

        self.client.write_file(ROUNDTRIP_PATH, original)
        current = self.client.read_file(ROUNDTRIP_PATH)

        self.assertEqual(current, original)
