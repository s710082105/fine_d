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


class JvmBridgeRunnerCompileCompatibilityTest(unittest.TestCase):
    def test_compile_targets_java8_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runner = build_runner(Path(temp_dir))
            calls: list[list[str]] = []

            def fake_run(arguments: list[str], *, cwd: Path) -> subprocess.CompletedProcess[str]:
                calls.append(arguments)
                write_class_file(runner)
                return subprocess.CompletedProcess(arguments, 0, "", "")

            with patch("fine_remote.jvm.run_subprocess", side_effect=fake_run):
                runner._compile_if_needed()

            self.assertEqual(len(calls), 1)
            self.assertIn("--release", calls[0])
            self.assertIn("8", calls[0])

    def test_compile_falls_back_to_source_target_when_release_flag_is_unsupported(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runner = build_runner(Path(temp_dir))
            calls: list[list[str]] = []

            def fake_run(arguments: list[str], *, cwd: Path) -> subprocess.CompletedProcess[str]:
                calls.append(arguments)
                if len(calls) == 1:
                    return subprocess.CompletedProcess(arguments, 2, "", "invalid flag: --release")
                write_class_file(runner)
                return subprocess.CompletedProcess(arguments, 0, "", "")

            with patch("fine_remote.jvm.run_subprocess", side_effect=fake_run):
                runner._compile_if_needed()

            self.assertEqual(len(calls), 2)
            self.assertEqual(calls[0][1:3], ["--release", "8"])
            self.assertEqual(calls[1][1:5], ["-source", "8", "-target", "8"])

    def test_compile_rebuilds_when_stale_class_has_no_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            runner = build_runner(Path(temp_dir))
            class_file = runner._build_dir / "fine_remote" / "FrRemoteBridge.class"
            class_file.parent.mkdir(parents=True, exist_ok=True)
            class_file.write_bytes(b"old")
            future_time = runner._source_file.stat().st_mtime + 60
            os.utime(class_file, (future_time, future_time))

            with patch("fine_remote.jvm.run_subprocess") as mocked_run:
                mocked_run.side_effect = lambda arguments, *, cwd: (
                    write_class_file(runner),
                    subprocess.CompletedProcess(arguments, 0, "", ""),
                )[1]
                runner._compile_if_needed()

            mocked_run.assert_called_once()


def build_runner(temp_dir: Path) -> JvmBridgeRunner:
    fine_home = temp_dir / "FineReport"
    (fine_home / "lib").mkdir(parents=True, exist_ok=True)
    (fine_home / "lib" / "core.jar").write_text("", encoding="utf-8")
    source_file = temp_dir / "FrRemoteBridge.java"
    source_file.write_text("class FrRemoteBridge {}", encoding="utf-8")
    runner = JvmBridgeRunner(
        JvmBridgeConfig(
            fine_home=fine_home,
            java_bin="java",
            javac_bin="javac",
        )
    )
    runner._source_file = source_file
    runner._build_dir = temp_dir / "build"
    return runner


def write_class_file(runner: JvmBridgeRunner) -> None:
    class_file = runner._build_dir / "fine_remote" / "FrRemoteBridge.class"
    class_file.parent.mkdir(parents=True, exist_ok=True)
    class_file.write_bytes(b"class")
