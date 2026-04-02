export type SectionId = 'workbench' | 'codex'

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

export interface CurrentProjectResponse {
  readonly path: string
  readonly name: string
}

export interface RemoteProfileResponse {
  readonly base_url: string
  readonly username: string
  readonly password: string
  readonly designer_root: string
}

export interface ProjectCurrentStateResponse {
  readonly current_project: CurrentProjectResponse | null
  readonly remote_profile: RemoteProfileResponse | null
  readonly context_state: ProjectContextStateResponse | null
}

export type ProjectContextStatus = 'created' | 'kept' | 'updated'

export interface ProjectContextStateResponse {
  readonly generated_at: string
  readonly agents_status: ProjectContextStatus
}

export interface ProjectContextResponse {
  readonly project_root: string
  readonly generated_at: string
  readonly agents_status: ProjectContextStatus
  readonly managed_files: readonly string[]
}

export interface ProjectRemoteProfileStateResponse {
  readonly remote_profile: RemoteProfileResponse
}

export interface RemoteDirectoryEntryResponse {
  readonly name: string
  readonly path: string
  readonly is_directory: boolean
  readonly lock: string | null
}

export type RemoteDirectoryLoader = (
  path?: string
) => Promise<readonly RemoteDirectoryEntryResponse[]>

export interface RemoteProfileTestResponse {
  readonly status: string
  readonly message: string
}

export interface RemoteOverviewResponse {
  readonly directory_entries: readonly RemoteDirectoryEntryResponse[]
  readonly data_connections: readonly DatasourceConnectionResponse[]
  readonly last_loaded_at: string
}

export type CodexTerminalStatus = 'running' | 'closed' | 'failed'

export interface CodexTerminalSessionResponse {
  readonly session_id: string
  readonly status: CodexTerminalStatus
  readonly working_directory: string
}

export interface CodexTerminalStreamResponse {
  readonly session_id: string
  readonly status: CodexTerminalStatus
  readonly output: string
  readonly next_cursor: number
  readonly has_backlog: boolean
  readonly completed: boolean
}

export interface CodexTerminalInputAcceptedResponse {
  readonly accepted: boolean
}

export interface DatasourceConnectionResponse {
  readonly name: string
  readonly database_type: string
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

export type SyncAction =
  | 'sync_file'
  | 'sync_directory'
  | 'pull_remote_file'
  | 'publish_project'
  | 'verify_remote_state'

export interface SyncResultResponse {
  readonly action: SyncAction
  readonly status: 'pending' | 'running' | 'success' | 'failed' | 'verified'
  readonly target_path: string | null
  readonly remote_path: string | null
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
