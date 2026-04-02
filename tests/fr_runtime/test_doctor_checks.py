from pathlib import Path

from tooling.fr_runtime.doctor.checks import detect_designer_java


def test_detect_designer_java_prefers_designer_runtime(tmp_path: Path) -> None:
    java_path = tmp_path / "Contents" / "runtime" / "Contents" / "Home" / "bin" / "java"
    java_path.parent.mkdir(parents=True)
    java_path.write_text("")
    assert detect_designer_java(tmp_path) == java_path
