from pathlib import Path
from typing import Protocol

from backend.domain.datasource.models import ConnectionSummary, SqlPreviewResult
from backend.domain.project.errors import invalid_remote_profile_error
from backend.domain.project.remote_models import RemoteProfile
from backend.infra.project_store import ProjectStore


class DatasourceGateway(Protocol):
    def list_connections(self) -> list[ConnectionSummary]:
        ...

    def preview_sql(self, connection_name: str, sql: str) -> SqlPreviewResult:
        ...


class DatasourceGatewayFactory(Protocol):
    def create(self, profile: RemoteProfile) -> DatasourceGateway:
        ...


class ProjectDatasourceUseCases:
    def __init__(
        self,
        project_store: ProjectStore,
        gateway_factory: DatasourceGatewayFactory,
    ) -> None:
        self._project_store = project_store
        self._gateway_factory = gateway_factory

    def list_connections(self, project_path: Path) -> list[ConnectionSummary]:
        return self._gateway(project_path).list_connections()

    def preview_sql(
        self,
        project_path: Path,
        connection_name: str,
        sql: str,
    ) -> SqlPreviewResult:
        return self._gateway(project_path).preview_sql(connection_name, sql)

    def _gateway(self, project_path: Path) -> DatasourceGateway:
        profile = self._project_store.load_remote_profile(project_path)
        validated_profile = _require_datasource_profile(profile)
        return self._gateway_factory.create(validated_profile)


def _require_datasource_profile(profile: RemoteProfile | None) -> RemoteProfile:
    if profile is None:
        raise invalid_remote_profile_error("remote_profile")
    if profile.base_url == "":
        raise invalid_remote_profile_error("base_url")
    if profile.username == "":
        raise invalid_remote_profile_error("username")
    if profile.password == "":
        raise invalid_remote_profile_error("password")
    return profile
