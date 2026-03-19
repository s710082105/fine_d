export type SyncProtocol = 'sftp' | 'ftp' | 'local'
export type PreviewMode = 'embedded' | 'external'
export const PROJECT_SOURCE_SUBDIR = 'reportlets'

export interface StyleProfile {
  font_family: string
  font_size: number
  line_height: number
  column_width: number
  header_font_family: string
  header_font_size: number
  number_format: string
}

export interface WorkspaceProfile {
  name: string
  root_dir: string
}

export interface DataConnectionProfile {
  connection_name: string
  dsn: string
  username: string
  password: string
}

export interface PreviewProfile {
  url: string
  mode: PreviewMode
}

export interface SyncProfile {
  protocol: SyncProtocol
  host: string
  port: number
  username: string
  remote_runtime_dir: string
  delete_propagation: boolean
  auto_sync_on_change: boolean
}

export interface AiProfile {
  provider: string
  model: string
}

export interface ProjectMapping {
  local: string
  remote: string
}

export interface ReportletEntry {
  name: string
  path: string
  kind: 'file' | 'directory'
  children: ReportletEntry[]
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
