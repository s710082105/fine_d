export type SectionId =
  | 'project'
  | 'datasource'
  | 'reportlet'
  | 'sync'
  | 'preview'
  | 'assistant'

export interface AppSection {
  readonly id: SectionId
  readonly label: string
  readonly summary: string
}

export interface HealthResponse {
  readonly status: 'ok'
}

export interface ProjectConfigResponse {
  readonly workspace_dir: string
  readonly generated_dir: string
}

export interface DatasourceConnectionResponse {
  readonly name: string
}

export interface DatasourceSqlPreviewResponse {
  readonly columns: readonly string[]
  readonly rows: readonly (readonly unknown[])[]
}

export interface PreviewSessionResponse {
  readonly session_id: string
  readonly url: string
  readonly status: 'opened'
}

export interface ReportletTreeNodeResponse {
  readonly name: string
  readonly path: string
  readonly kind: 'file' | 'directory'
  readonly children: readonly ReportletTreeNodeResponse[]
}

export interface ReportletFileResponse {
  readonly name: string
  readonly path: string
  readonly content: string
  readonly encoding: 'utf-8' | 'base64'
}

export type AssistantRouteStatus = 'routed' | 'needs_clarification'

export type AssistantModule =
  | 'datasource'
  | 'reportlet'
  | 'sync'
  | 'preview'
  | 'assistant'

export interface AssistantRouteResponse {
  readonly prompt: string
  readonly status: AssistantRouteStatus
  readonly module: AssistantModule
  readonly actions: readonly string[]
  readonly message: string
}
