export type SyncProtocol = 'sftp' | 'ftp'

export interface StyleProfile {
  theme: string
}

export interface WorkspaceProfile {
  name: string
  root_dir: string
}

export interface SyncProfile {
  protocol: SyncProtocol
  host: string
  port: number
  username: string
  local_source_dir: string
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

export interface ProjectConfig {
  style: StyleProfile
  workspace: WorkspaceProfile
  sync: SyncProfile
  ai: AiProfile
  mappings: ProjectMapping[]
}
