import importlib.util
import json
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from textwrap import dedent

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / "bridge" / "scripts" / "build_bridge.py"
SOURCE_ROOT = REPO_ROOT / "bridge" / "src" / "fine" / "remote" / "bridge"
TRIAL_EXPIRED_MESSAGE = "试用过期，请获取正式版"


def _load_build_module():
    spec = importlib.util.spec_from_file_location("build_bridge", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_default_trial_expiry_is_three_days_from_build_time() -> None:
    module = _load_build_module()
    before = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(module._default_trial_expires_at().replace("Z", "+00:00"))
    after = datetime.now(timezone.utc)

    lower_bound = before + timedelta(days=3, seconds=-1)
    upper_bound = after + timedelta(days=3, seconds=1)
    assert lower_bound <= expires_at <= upper_bound


@pytest.mark.skipif(
    shutil.which("javac") is None or shutil.which("java") is None or shutil.which("jar") is None,
    reason="javac/java/jar not available",
)
def test_bridge_returns_trial_expired_when_ntp_unavailable(tmp_path: Path) -> None:
    module = _load_build_module()
    artifacts = module.build_bridge(
        project_root=REPO_ROOT,
        dist_dir=tmp_path / "dist",
        trial_expires_at="2099-01-01T00:00:00Z",
        ntp_servers=("127.0.0.1:9",),
    )

    response = _run_bridge(artifacts.jar_path, "list")

    assert response["returncode"] == 2
    assert response["payload"] == {
        "status": "error",
        "operation": "list",
        "message": TRIAL_EXPIRED_MESSAGE,
    }


@pytest.mark.skipif(
    shutil.which("javac") is None or shutil.which("java") is None,
    reason="javac/java not available",
)
def test_trial_guard_returns_expired_message_when_time_source_passes_deadline(tmp_path: Path) -> None:
    output = _run_trial_guard_probe(
        tmp_path,
        current_time="2026-04-05T00:00:00Z",
        expires_at="2026-04-04T23:59:59Z",
    )

    assert output == TRIAL_EXPIRED_MESSAGE


@pytest.mark.skipif(
    shutil.which("javac") is None or shutil.which("java") is None,
    reason="javac/java not available",
)
def test_trial_guard_allows_requests_before_deadline(tmp_path: Path) -> None:
    output = _run_trial_guard_probe(
        tmp_path,
        current_time="2026-04-04T00:00:00Z",
        expires_at="2026-04-05T00:00:00Z",
    )

    assert output == "ok"


def _run_bridge(jar_path: Path, operation: str) -> dict[str, object]:
    result = subprocess.run(
        [shutil.which("java") or "java", "-jar", str(jar_path), operation],
        capture_output=True,
        text=True,
        check=False,
    )
    raw = result.stdout.strip() or result.stderr.strip()
    return {
        "returncode": result.returncode,
        "payload": json.loads(raw),
    }


def _run_trial_guard_probe(tmp_path: Path, current_time: str, expires_at: str) -> str:
    source_root = tmp_path / "src"
    probe_path = source_root / "fine" / "remote" / "bridge" / "TrialGuardProbe.java"
    probe_path.parent.mkdir(parents=True, exist_ok=True)
    probe_path.write_text(
        dedent(
            f"""
            package fine.remote.bridge;

            import java.time.Instant;

            public final class TrialGuardProbe {{
              private TrialGuardProbe() {{
              }}

              public static void main(String[] args) throws Exception {{
                TrialGuard guard = new TrialGuard(
                    () -> Instant.parse("{current_time}"),
                    Instant.parse("{expires_at}")
                );
                try {{
                  guard.ensureValid();
                  System.out.print("ok");
                }} catch (TrialExpiredException exception) {{
                  System.out.print(exception.getMessage());
                }}
              }}
            }}
            """
        ).strip()
        + "\n"
    )
    classes_dir = tmp_path / "classes"
    classes_dir.mkdir()
    subprocess.run(
        [
            shutil.which("javac") or "javac",
            "--release",
            "8",
            "-Xlint:-options",
            "-encoding",
            "UTF-8",
            "-d",
            str(classes_dir),
            *[str(path) for path in SOURCE_ROOT.glob("*.java")],
            str(probe_path),
        ],
        check=True,
    )
    result = subprocess.run(
        [
            shutil.which("java") or "java",
            "-cp",
            str(classes_dir),
            "fine.remote.bridge.TrialGuardProbe",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    return result.stdout.strip()
