import base64
from pathlib import Path

import pytest

from tooling.fr_runtime.sync.service import SyncService, normalize_remote_path


def test_normalize_remote_path_rejects_non_reportlets_targets() -> None:
    with pytest.raises(ValueError, match="reportlets"):
        normalize_remote_path("../etc/passwd")


def test_sync_service_pull_writes_remote_file_to_workspace(tmp_path: Path) -> None:
    class FakeBridge:
        def invoke(self, operation: str, payload: dict[str, object]) -> dict[str, object]:
            assert operation == "read"
            assert payload["path"] == "reportlets/demo/report.cpt"
            return {
                "contentBase64": base64.b64encode(b"<xml>demo</xml>").decode(),
                "size": 15,
            }

    service = SyncService(
        bridge=FakeBridge(),
        workspace_root=tmp_path,
        template_root=tmp_path / "templates",
    )

    result = service.pull("reportlets/demo/report.cpt")

    local_path = tmp_path / "reportlets" / "demo" / "report.cpt"
    assert local_path.read_bytes() == b"<xml>demo</xml>"
    assert result["local_path"] == str(local_path)
    assert result["remote_path"] == "reportlets/demo/report.cpt"


def test_sync_service_push_verifies_remote_round_trip(tmp_path: Path) -> None:
    pushed: dict[str, object] = {}
    reportlet_path = tmp_path / "reportlets" / "demo" / "report.cpt"
    reportlet_path.parent.mkdir(parents=True)
    reportlet_path.write_bytes(b"<xml>push</xml>")

    class FakeBridge:
        def invoke(self, operation: str, payload: dict[str, object]) -> dict[str, object]:
            if operation == "list":
                return {"items": []}
            if operation == "write":
                pushed["payload"] = payload
                return {"status": "ok"}
            if operation == "read":
                return {
                    "contentBase64": base64.b64encode(b"<xml>push</xml>").decode(),
                    "size": 15,
                }
            raise AssertionError(operation)

    service = SyncService(
        bridge=FakeBridge(),
        workspace_root=tmp_path,
        template_root=tmp_path / "templates",
    )

    result = service.push("reportlets/demo/report.cpt")

    assert result["status"] == "verified"
    assert pushed["payload"]["path"] == "reportlets/demo/report.cpt"


def test_sync_service_prepare_create_rejects_existing_remote(tmp_path: Path) -> None:
    template_root = tmp_path / "templates"
    template_root.mkdir()
    (template_root / "blank.cpt").write_text("<xml/>")

    class FakeBridge:
        def invoke(self, operation: str, payload: dict[str, object]) -> dict[str, object]:
            if operation == "list":
                return {
                    "items": [
                        {
                            "name": "report.cpt",
                            "path": "reportlets/demo/report.cpt",
                            "directory": False,
                            "lock": None,
                        }
                    ]
                }
            raise AssertionError(operation)

    service = SyncService(
        bridge=FakeBridge(),
        workspace_root=tmp_path,
        template_root=template_root,
    )

    with pytest.raises(FileExistsError, match="already exists"):
        service.prepare_create("reportlets/demo/report.cpt")
