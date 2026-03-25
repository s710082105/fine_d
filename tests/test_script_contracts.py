from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"


def read_script(name: str) -> str:
    path = SCRIPTS_DIR / name

    assert path.exists(), f"missing script: {path}"
    return path.read_text(encoding="utf-8")


def test_install_scripts_cover_runtime_and_dependency_contracts() -> None:
    macos_script = read_script("install-macos.sh")
    windows_script = read_script("install-windows.ps1")

    assert "python" in macos_script.lower()
    assert "node" in macos_script.lower()
    assert "uv sync --extra dev" in macos_script
    assert "pnpm install" in macos_script

    assert "Python.Python.3" in windows_script
    assert "OpenJS.NodeJS.LTS" in windows_script
    assert "uv sync --extra dev" in windows_script
    assert "pnpm install" in windows_script


def test_start_scripts_cover_repo_level_startup_contracts() -> None:
    macos_script = read_script("start-macos.sh")
    windows_script = read_script("start-windows.cmd")

    assert "apps/api" in macos_script
    assert "apps/web" in macos_script
    assert "http://127.0.0.1:18080" in macos_script
    assert "runtime" not in macos_script.lower()

    assert "apps\\api" in windows_script
    assert "apps\\web" in windows_script
    assert "http://127.0.0.1:18080" in windows_script
    assert 'start "" "http://127.0.0.1:18080"' in windows_script.lower()
    assert "runtime" not in windows_script.lower()


def test_doctor_scripts_cover_diagnostic_contracts() -> None:
    macos_script = read_script("doctor-macos.sh")
    windows_script = read_script("doctor-windows.ps1")

    assert "python3 --version" in macos_script
    assert "node --version" in macos_script
    assert "18080" in macos_script
    assert "browser" in macos_script.lower()
    assert "finereport" in macos_script.lower()

    assert "python" in windows_script.lower()
    assert "node" in windows_script.lower()
    assert "18080" in windows_script
    assert "browser" in windows_script.lower()
    assert "FineReport" in windows_script
