import importlib.util
import json
import re
import shutil
import subprocess
from pathlib import Path
from textwrap import dedent

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_SCRIPT = REPO_ROOT / "bridge" / "scripts" / "build_bridge.py"
AUTH_SCRIPT = REPO_ROOT / "bridge" / "scripts" / "generate_authorization.py"
SOURCE_ROOT = REPO_ROOT / "bridge" / "src" / "fine" / "remote" / "bridge"
AUTH_FILE_NAME = "fr-remote-bridge.auth"


def _load_build_module():
    spec = importlib.util.spec_from_file_location("build_bridge", BUILD_SCRIPT)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.skipif(
    any(shutil.which(name) is None for name in ("javac", "java", "jar", "openssl")),
    reason="javac/java/jar/openssl not available",
)
def test_bridge_returns_mac_prompt_when_authorization_file_missing(tmp_path: Path) -> None:
    private_key, public_key = _generate_rsa_key_pair(tmp_path)
    module = _load_build_module()
    artifacts = module.build_bridge(
        project_root=REPO_ROOT,
        dist_dir=tmp_path / "dist",
        license_public_key_file=public_key,
    )

    response = _run_bridge(artifacts.jar_path, "list")

    assert private_key.exists()
    assert response["returncode"] == 2
    message = response["payload"]["message"]
    assert message.startswith("设备 MAC:")
    assert message.endswith("请联系管理员授权")
    assert re.search(r"(UNKNOWN|[0-9A-F]{2}(:[0-9A-F]{2}){5})", message)


@pytest.mark.skipif(
    any(shutil.which(name) is None for name in ("javac", "java", "jar", "openssl")),
    reason="javac/java/jar/openssl not available",
)
def test_generate_authorization_script_creates_license_accepted_before_expiry(tmp_path: Path) -> None:
    private_key, public_key = _generate_rsa_key_pair(tmp_path)
    _run_authorization_script(
        private_key=private_key,
        output_dir=tmp_path / "dist",
        mac="AA-BB-CC-DD-EE-FF",
        expires_at="2099-01-01T00:00:00Z",
    )

    output = _run_authorization_probe(
        tmp_path=tmp_path,
        auth_dir=tmp_path / "dist",
        public_key=public_key,
        current_time="2026-04-04T00:00:00Z",
        macs=["AA:BB:CC:DD:EE:FF"],
    )

    assert output == "ok"


@pytest.mark.skipif(
    any(shutil.which(name) is None for name in ("javac", "java", "jar", "openssl")),
    reason="javac/java/jar/openssl not available",
)
def test_generate_authorization_script_rejects_license_after_expiry(tmp_path: Path) -> None:
    private_key, public_key = _generate_rsa_key_pair(tmp_path)
    _run_authorization_script(
        private_key=private_key,
        output_dir=tmp_path / "dist",
        mac="AA:BB:CC:DD:EE:FF",
        expires_at="2026-04-05T00:00:00Z",
    )

    output = _run_authorization_probe(
        tmp_path=tmp_path,
        auth_dir=tmp_path / "dist",
        public_key=public_key,
        current_time="2026-04-06T00:00:00Z",
        macs=["AA:BB:CC:DD:EE:FF"],
    )

    assert output == "设备 MAC: AA:BB:CC:DD:EE:FF，请联系管理员授权"


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


def _generate_rsa_key_pair(tmp_path: Path) -> tuple[Path, Path]:
    private_key = tmp_path / "license-private.pem"
    public_key = tmp_path / "license-public.pem"
    subprocess.run(
        [
            shutil.which("openssl") or "openssl",
            "genpkey",
            "-algorithm",
            "RSA",
            "-pkeyopt",
            "rsa_keygen_bits:2048",
            "-out",
            str(private_key),
        ],
        capture_output=True,
        check=True,
    )
    subprocess.run(
        [
            shutil.which("openssl") or "openssl",
            "rsa",
            "-pubout",
            "-in",
            str(private_key),
            "-out",
            str(public_key),
        ],
        capture_output=True,
        check=True,
    )
    return private_key, public_key


def _run_authorization_script(
    private_key: Path,
    output_dir: Path,
    mac: str,
    expires_at: str,
) -> None:
    subprocess.run(
        [
            shutil.which("python3") or "python3",
            str(AUTH_SCRIPT),
            "--private-key-file",
            str(private_key),
            "--output-dir",
            str(output_dir),
            "--mac",
            mac,
            "--expires-at",
            expires_at,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    assert (output_dir / AUTH_FILE_NAME).exists()


def _run_authorization_probe(
    tmp_path: Path,
    auth_dir: Path,
    public_key: Path,
    current_time: str,
    macs: list[str],
) -> str:
    probe_path = tmp_path / "src" / "fine" / "remote" / "bridge" / "AuthorizationProbe.java"
    probe_path.parent.mkdir(parents=True, exist_ok=True)
    mac_list = ", ".join(f'"{value}"' for value in macs)
    public_key_text = public_key.read_text().replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')
    probe_path.write_text(
        dedent(
            f"""
            package fine.remote.bridge;

            import java.nio.file.Paths;
            import java.time.Instant;
            import java.util.Arrays;

            public final class AuthorizationProbe {{
              private AuthorizationProbe() {{
              }}

              public static void main(String[] args) throws Exception {{
                AuthorizationGuard guard = new AuthorizationGuard(
                    () -> Arrays.asList({mac_list}),
                    () -> Instant.parse("{current_time}"),
                    Paths.get("{auth_dir}"),
                    "{AUTH_FILE_NAME}",
                    "{public_key_text}"
                );
                try {{
                  guard.ensureAuthorized();
                  System.out.print("ok");
                }} catch (AuthorizationException exception) {{
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
        capture_output=True,
        text=True,
        check=True,
    )
    result = subprocess.run(
        [
            shutil.which("java") or "java",
            "-cp",
            str(classes_dir),
            "fine.remote.bridge.AuthorizationProbe",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    return result.stdout.strip()
