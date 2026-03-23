from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fine_remote.client import FineRemoteClient


class FineRemoteClientJvmResolutionTest(unittest.TestCase):
    def test_prefers_bundled_java_tools_under_fine_home(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            fine_home = Path(temp_dir)
            java_bin = fine_home / "jre" / "bin" / "java"
            javac_bin = fine_home / "jdk" / "bin" / "javac"
            java_bin.parent.mkdir(parents=True, exist_ok=True)
            javac_bin.parent.mkdir(parents=True, exist_ok=True)
            java_bin.write_text("", encoding="utf-8")
            javac_bin.write_text("", encoding="utf-8")

            client = FineRemoteClient(
                base_url="http://demo",
                username="user",
                password="pass",
                fine_home=fine_home,
            )

            self.assertEqual(client._bridge._config.java_bin, str(java_bin))
            self.assertEqual(client._bridge._config.javac_bin, str(javac_bin))

    def test_keeps_default_commands_when_bundled_java_tools_are_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            client = FineRemoteClient(
                base_url="http://demo",
                username="user",
                password="pass",
                fine_home=Path(temp_dir),
            )

            self.assertEqual(client._bridge._config.java_bin, "java")
            self.assertEqual(client._bridge._config.javac_bin, "javac")

    def test_prefers_bundled_java_and_falls_back_to_path_javac(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            fine_home = Path(temp_dir)
            java_bin = fine_home / "jre" / "bin" / "java"
            java_bin.parent.mkdir(parents=True, exist_ok=True)
            java_bin.write_text("", encoding="utf-8")

            client = FineRemoteClient(
                base_url="http://demo",
                username="user",
                password="pass",
                fine_home=fine_home,
            )

            self.assertEqual(client._bridge._config.java_bin, str(java_bin))
            self.assertEqual(client._bridge._config.javac_bin, "javac")
