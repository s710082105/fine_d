import base64
from pathlib import Path

from fastapi.testclient import TestClient

from apps.api.routes.reportlet import get_reportlet_service
from backend.adapters.system.file_gateway import FileGateway
from backend.app_factory import create_app
from backend.application.reportlet.use_cases import ReportletUseCases
from backend.domain.project.errors import AppError
from backend.domain.reportlet.models import ReportletEntry, ReportletFile


class FailingReportletService:
    def list_tree(self) -> list[ReportletEntry]:
        raise AppError(
            code="reportlet.invalid_response",
            message="bad response",
            detail={"path": "reportlets"},
            source="reportlet",
        )


def create_reportlet_client(root: Path) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_reportlet_service] = lambda: ReportletUseCases(
        FileGateway(root)
    )
    return TestClient(app)


def test_tree_endpoint_returns_expected_schema(tmp_path: Path) -> None:
    root = tmp_path / "workspace" / "reportlets"
    (root / "sales").mkdir(parents=True)
    (root / "sales" / "demo.cpt").write_text("hello", encoding="utf-8")
    client = create_reportlet_client(root)

    response = client.get("/api/reportlets/tree")

    assert response.status_code == 200
    assert response.json() == [
        {
            "name": "sales",
            "path": "sales",
            "kind": "directory",
            "children": [
                {
                    "name": "demo.cpt",
                    "path": "sales/demo.cpt",
                    "kind": "file",
                    "children": [],
                }
            ],
        }
    ]


def test_content_endpoint_returns_utf8_text_file(tmp_path: Path) -> None:
    root = tmp_path / "workspace" / "reportlets"
    root.mkdir(parents=True)
    (root / "demo.cpt").write_text("文本内容", encoding="utf-8")
    client = create_reportlet_client(root)

    response = client.get("/api/reportlets/content", params={"path": "demo.cpt"})

    assert response.status_code == 200
    assert response.json() == {
        "name": "demo.cpt",
        "path": "demo.cpt",
        "content": "文本内容",
        "encoding": "utf-8",
    }


def test_content_endpoint_round_trips_binary_fvs_via_base64(tmp_path: Path) -> None:
    root = tmp_path / "workspace" / "reportlets"
    root.mkdir(parents=True)
    payload = b"PK\x03\x04binary-fvs\x00\xff"
    encoded = base64.b64encode(payload).decode("ascii")
    client = create_reportlet_client(root)

    write_response = client.put(
        "/api/reportlets/content",
        json={"path": "demo.fvs", "content": encoded, "encoding": "base64"},
    )
    read_response = client.get("/api/reportlets/content", params={"path": "demo.fvs"})

    assert write_response.status_code == 200
    assert write_response.json() == {
        "name": "demo.fvs",
        "path": "demo.fvs",
        "content": encoded,
        "encoding": "base64",
    }
    assert read_response.status_code == 200
    assert read_response.json() == {
        "name": "demo.fvs",
        "path": "demo.fvs",
        "content": encoded,
        "encoding": "base64",
    }


def test_write_endpoint_rejects_directory_target_with_app_error(tmp_path: Path) -> None:
    root = tmp_path / "workspace" / "reportlets"
    (root / "sales").mkdir(parents=True)
    client = create_reportlet_client(root)

    response = client.put(
        "/api/reportlets/content",
        json={"path": "sales", "content": "updated", "encoding": "utf-8"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "code": "reportlet.invalid_file",
        "message": "reportlet path must point to a file",
        "detail": {"path": "sales"},
        "source": "reportlet",
        "retryable": False,
    }


def test_reportlet_route_app_error_uses_unified_json_response() -> None:
    app = create_app()
    app.dependency_overrides[get_reportlet_service] = lambda: FailingReportletService()
    client = TestClient(app)

    response = client.get("/api/reportlets/tree")

    assert response.status_code == 400
    assert response.json() == {
        "code": "reportlet.invalid_response",
        "message": "bad response",
        "detail": {"path": "reportlets"},
        "source": "reportlet",
        "retryable": False,
    }
