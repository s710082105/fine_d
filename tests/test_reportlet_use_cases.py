from pathlib import Path

import pytest

from backend.adapters.system.file_gateway import FileGateway
from backend.application.reportlet.use_cases import ReportletUseCases
from backend.domain.project.errors import AppError


def test_list_reportlets_returns_tree(tmp_path: Path) -> None:
    root = tmp_path / "workspace" / "reportlets"
    root.mkdir(parents=True)
    (root / "demo.cpt").write_text("ok", encoding="utf-8")
    use_case = ReportletUseCases(FileGateway(root))

    result = use_case.list_tree()

    assert result[0].name == "demo.cpt"
    assert result[0].path == "demo.cpt"
    assert result[0].kind == "file"
    assert result[0].children == []


def test_create_from_template_rejects_path_outside_root(tmp_path: Path) -> None:
    root = tmp_path / "workspace" / "reportlets"
    root.mkdir(parents=True)
    (root / "template.cpt").write_text("seed", encoding="utf-8")
    use_case = ReportletUseCases(FileGateway(root))

    with pytest.raises(AppError) as exc_info:
        use_case.create_from_template(Path("../escape.cpt"), Path("template.cpt"))

    assert exc_info.value.code == "reportlet.invalid_path"


def test_create_copy_read_and_write_reportlet(tmp_path: Path) -> None:
    root = tmp_path / "workspace" / "reportlets"
    root.mkdir(parents=True)
    (root / "template.cpt").write_text("seed", encoding="utf-8")
    use_case = ReportletUseCases(FileGateway(root))

    created = use_case.create_from_template(
        target=Path("sales/new-report.cpt"),
        template=Path("template.cpt"),
    )
    updated = use_case.write(Path("sales/new-report.cpt"), "updated")
    copied = use_case.copy(Path("sales/new-report.cpt"), Path("sales/copy-report.cpt"))
    loaded = use_case.read(Path("sales/copy-report.cpt"))

    assert created.content == "seed"
    assert created.path == "sales/new-report.cpt"
    assert updated.content == "updated"
    assert copied.name == "copy-report.cpt"
    assert loaded.content == "updated"


def test_copy_and_create_from_template_reject_directory_target(tmp_path: Path) -> None:
    root = tmp_path / "workspace" / "reportlets"
    root.mkdir(parents=True)
    (root / "template.cpt").write_text("seed", encoding="utf-8")
    (root / "sales").mkdir()
    use_case = ReportletUseCases(FileGateway(root))

    with pytest.raises(AppError) as copy_error:
        use_case.copy(Path("template.cpt"), Path("sales"))

    with pytest.raises(AppError) as template_error:
        use_case.create_from_template(Path("sales"), Path("template.cpt"))

    assert copy_error.value.code == "reportlet.invalid_file"
    assert template_error.value.code == "reportlet.invalid_file"
