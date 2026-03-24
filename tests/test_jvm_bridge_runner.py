from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fine_remote.client import FineRemoteClient
from fine_remote.jvm import JvmBridgeConfig, JvmBridgeRunner


class FineRemoteClientJvmResolutionTest(unittest.TestCase):
    def test_prefers_bundled_java_runtime_under_fine_home(self) -> None:
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

    def test_keeps_default_java_command_when_bundled_runtime_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            client = FineRemoteClient(
                base_url="http://demo",
                username="user",
                password="pass",
                fine_home=Path(temp_dir),
            )

            self.assertEqual(client._bridge._config.java_bin, "java")

class JvmBridgeRunnerEmbeddedClassTest(unittest.TestCase):
    def test_invoke_uses_embedded_bridge_class_without_compiling(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runner = build_runner(Path(temp_dir))
            output_payload = '{"items":[]}'

            def fake_run(arguments: list[str], *, cwd: Path) -> subprocess.CompletedProcess[str]:
                output_index = arguments.index("--output-file") + 1
                Path(arguments[output_index]).write_text(output_payload, encoding="utf-8")
                return subprocess.CompletedProcess(arguments, 0, "", "")

            with patch("fine_remote.jvm.run_subprocess", side_effect=fake_run):
                payload = runner.invoke("list", options={"--path": "reportlets"})

            self.assertEqual(payload, {"items": []})

    def test_invoke_fails_when_embedded_bridge_class_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runner = build_runner(Path(temp_dir))
            (runner._bridge_dir / "FrRemoteBridge$Arguments.class").unlink()

            with self.assertRaisesRegex(RuntimeError, "Embedded bridge class is missing"):
                runner.invoke("list", options={"--path": "reportlets"})


def build_runner(temp_dir: Path) -> JvmBridgeRunner:
    fine_home = temp_dir / "FineReport"
    (fine_home / "lib").mkdir(parents=True, exist_ok=True)
    (fine_home / "lib" / "core.jar").write_text("", encoding="utf-8")
    class_root = temp_dir / "java" / "fine_remote"
    class_root.mkdir(parents=True, exist_ok=True)
    (class_root / "FrRemoteBridge.class").write_bytes(b"class")
    (class_root / "FrRemoteBridge$Arguments.class").write_bytes(b"class")
    runner = JvmBridgeRunner(
        JvmBridgeConfig(
            fine_home=fine_home,
            java_bin="java",
        )
    )
    runner._repo_root = temp_dir
    runner._class_root = temp_dir / "java"
    runner._bridge_dir = class_root
    return runner
