from pathlib import Path

import pytest

from backend.domain.datasource.models import ConnectionSummary, SqlPreviewResult
from backend.domain.project.errors import AppError
from backend.domain.project.remote_models import RemoteProfile
from backend.infra.project_store import ProjectStore


class FakeDatasourceGateway:
    def list_connections(self) -> list[ConnectionSummary]:
        return [ConnectionSummary(name="FRDemo", database_type="MYSQL")]

    def preview_sql(self, connection_name: str, sql: str) -> SqlPreviewResult:
        assert connection_name == "FRDemo"
        assert sql == "select 1 as ok"
        return SqlPreviewResult(columns=["ok"], rows=[[1]])


class FakeDatasourceGatewayFactory:
    def __init__(self) -> None:
        self.created_profiles: list[RemoteProfile] = []

    def create(self, profile: RemoteProfile) -> FakeDatasourceGateway:
        self.created_profiles.append(profile)
        return FakeDatasourceGateway()


def test_project_datasource_use_cases_read_connections_from_project_profile(
    tmp_path: Path,
) -> None:
    from backend.application.datasource.project_use_cases import (
        ProjectDatasourceUseCases,
    )

    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    store = ProjectStore(base_dir=tmp_path)
    store.save_remote_profile(
        project_dir,
        RemoteProfile(
            base_url="http://localhost:8075/webroot/decision",
            username="admin",
            password="admin",
            designer_root="/Applications/FineReport",
        ),
    )
    gateway_factory = FakeDatasourceGatewayFactory()
    use_cases = ProjectDatasourceUseCases(store, gateway_factory)

    result = use_cases.list_connections(project_dir)

    assert result == [ConnectionSummary(name="FRDemo", database_type="MYSQL")]
    assert gateway_factory.created_profiles == [
        RemoteProfile(
            base_url="http://localhost:8075/webroot/decision",
            username="admin",
            password="admin",
            designer_root="/Applications/FineReport",
        )
    ]


def test_project_datasource_use_cases_preview_sql_with_project_profile(
    tmp_path: Path,
) -> None:
    from backend.application.datasource.project_use_cases import (
        ProjectDatasourceUseCases,
    )

    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    store = ProjectStore(base_dir=tmp_path)
    store.save_remote_profile(
        project_dir,
        RemoteProfile(
            base_url="http://localhost:8075/webroot/decision",
            username="admin",
            password="admin",
            designer_root="/Applications/FineReport",
        ),
    )
    use_cases = ProjectDatasourceUseCases(store, FakeDatasourceGatewayFactory())

    result = use_cases.preview_sql(project_dir, "FRDemo", "select 1 as ok")

    assert result == SqlPreviewResult(columns=["ok"], rows=[[1]])


def test_project_datasource_use_cases_fail_explicitly_without_project_profile(
    tmp_path: Path,
) -> None:
    from backend.application.datasource.project_use_cases import (
        ProjectDatasourceUseCases,
    )

    project_dir = tmp_path / "project-alpha"
    project_dir.mkdir()
    use_cases = ProjectDatasourceUseCases(
        ProjectStore(base_dir=tmp_path),
        FakeDatasourceGatewayFactory(),
    )

    with pytest.raises(AppError) as error_info:
        use_cases.list_connections(project_dir)

    assert error_info.value.code == "project.remote_profile_invalid"
    assert error_info.value.detail == {"field": "remote_profile"}
