import { invoke } from '@tauri-apps/api/core'
import type {
  ListRemoteDirectoriesRequest,
  ProjectConfig,
  RemoteDirectoryEntry,
  ReportletEntry
} from '../../lib/types/project-config'

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>
type LoadResult = { exists: boolean; config: ProjectConfig }

export type ProjectConfigServices = {
  browseDirectory: () => Promise<string | null>
  loadConfig: (projectDir: string) => Promise<LoadResult>
  listReportletEntries: (projectDir: string) => Promise<ReportletEntry[]>
  listRemoteDirectories: (
    request: ListRemoteDirectoriesRequest
  ) => Promise<RemoteDirectoryEntry[]>
  saveConfig: (projectDir: string, config: ProjectConfig) => Promise<void>
}

function resolveInvoke(): InvokeFn {
  return invoke
}

async function loadConfig(projectDir: string): Promise<LoadResult> {
  return resolveInvoke()<LoadResult>('load_project_config', { projectDir })
}

async function browseDirectory(): Promise<string | null> {
  const dialog = await import('@tauri-apps/plugin-dialog')
  const selected = await dialog.open({ directory: true, multiple: false })
  return typeof selected === 'string' ? selected : null
}

async function listReportletEntries(projectDir: string): Promise<ReportletEntry[]> {
  return resolveInvoke()<ReportletEntry[]>('list_reportlet_entries', { projectDir })
}

async function listRemoteDirectories(
  request: ListRemoteDirectoriesRequest
): Promise<RemoteDirectoryEntry[]> {
  return resolveInvoke()<RemoteDirectoryEntry[]>('list_remote_directories', { request })
}

async function saveConfig(projectDir: string, config: ProjectConfig): Promise<void> {
  await resolveInvoke()<void>('save_project_config', { projectDir, config })
}

export const tauriServices: ProjectConfigServices = {
  browseDirectory,
  loadConfig,
  listReportletEntries,
  listRemoteDirectories,
  saveConfig
}
