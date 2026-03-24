export type SyncProtocol = 'fine'
export type PreviewMode = 'embedded' | 'external'
export const PROJECT_SOURCE_SUBDIR = 'reportlets'
export const FIXED_REMOTE_RUNTIME_DIR = PROJECT_SOURCE_SUBDIR

export interface StyleProfile {
  instructions: string
}

export interface WorkspaceProfile {
  name: string
  root_dir: string
}

export type DbType = 'mysql' | 'postgresql' | 'oracle' | 'sqlserver'

export interface DataConnectionProfile {
  connection_name: string
  db_type: DbType
  host: string
  port: number
  database: string
  username: string
  password: string
}

export interface PreviewProfile {
  url: string
  mode: PreviewMode
  account: string
  password: string
}

export interface SyncProfile {
  protocol: SyncProtocol
  designer_root: string
  remote_runtime_dir: string
  delete_propagation: boolean
  auto_sync_on_change: boolean
}

export interface AiProfile {
  provider: string
  model: string
  api_key: string
}

export interface ProjectMapping {
  local: string
  remote: string
}

export interface ReportletEntry {
  name: string
  path: string
  kind: 'file' | 'directory'
  loaded?: boolean
  children: ReportletEntry[]
}

export interface RemoteDirectoryEntry {
  name: string
  path: string
  children: RemoteDirectoryEntry[]
}

export interface PrepareRemoteFileResult {
  ok: boolean
  command: string
  localPath: string
  remotePath: string
  message: string
}

export interface ListRemoteDirectoriesRequest {
  designerRoot: string
  url: string
  username: string
  password: string
  path: string
}

export interface TestRemoteSyncConnectionRequest {
  designerRoot: string
  url: string
  username: string
  password: string
  path: string
}

export interface ProjectConfig {
  style: StyleProfile
  workspace: WorkspaceProfile
  data_connections: DataConnectionProfile[]
  preview: PreviewProfile
  sync: SyncProfile
  ai: AiProfile
  mappings: ProjectMapping[]
}

export function resolveProjectSourceDir(rootDir: string): string {
  return rootDir.trim().length === 0
    ? `项目目录/${PROJECT_SOURCE_SUBDIR}`
    : `${rootDir.replace(/\/$/, '')}/${PROJECT_SOURCE_SUBDIR}`
}
