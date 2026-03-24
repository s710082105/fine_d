import { invoke } from '@tauri-apps/api/core'
import type {
  DesignerConnectionSummary,
  FineDecisionRequest,
  ListRemoteDirectoriesRequest,
  PrepareRemoteFileResult,
  ProjectConfig,
  RemoteDirectoryEntry,
  ReportletEntry,
  TestRemoteSyncConnectionRequest
} from '../../lib/types/project-config'

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>
type LoadResult = { exists: boolean; config: ProjectConfig }

export type TestConnectionResult = { ok: boolean; message: string }

export type ProjectConfigServices = {
  browseDirectory: () => Promise<string | null>
  loadConfig: (projectDir: string) => Promise<LoadResult>
  listDesignerConnections: (
    request: FineDecisionRequest
  ) => Promise<DesignerConnectionSummary[]>
  listReportletEntries: (
    projectDir: string,
    relativePath?: string
  ) => Promise<ReportletEntry[]>
  listRemoteReportletEntries: (
    request: TestRemoteSyncConnectionRequest
  ) => Promise<ReportletEntry[]>
  listRemoteDirectories: (
    request: ListRemoteDirectoriesRequest
  ) => Promise<RemoteDirectoryEntry[]>
  pullRemoteReportletFile: (
    projectDir: string,
    relativePath: string
  ) => Promise<PrepareRemoteFileResult>
  pushLocalReportletFile: (
    projectDir: string,
    relativePath: string
  ) => Promise<PrepareRemoteFileResult>
  saveConfig: (projectDir: string, config: ProjectConfig) => Promise<void>
  testRemoteSyncConnection: (
    request: TestRemoteSyncConnectionRequest
  ) => Promise<TestConnectionResult>
}

function resolveInvoke(): InvokeFn {
  return invoke
}

async function loadConfig(projectDir: string): Promise<LoadResult> {
  return resolveInvoke()<LoadResult>('load_project_config', { projectDir })
}

async function listDesignerConnections(
  request: FineDecisionRequest
): Promise<DesignerConnectionSummary[]> {
  return resolveInvoke()<DesignerConnectionSummary[]>('list_designer_connections', { request })
}

async function browseDirectory(): Promise<string | null> {
  const dialog = await import('@tauri-apps/plugin-dialog')
  const selected = await dialog.open({ directory: true, multiple: false })
  return typeof selected === 'string' ? selected : null
}

async function listReportletEntries(
  projectDir: string,
  relativePath?: string
): Promise<ReportletEntry[]> {
  const args = relativePath ? { projectDir, relativePath } : { projectDir }
  return resolveInvoke()<ReportletEntry[]>('list_reportlet_entries', args)
}

async function listRemoteReportletEntries(
  request: TestRemoteSyncConnectionRequest
): Promise<ReportletEntry[]> {
  return resolveInvoke()<ReportletEntry[]>('list_remote_reportlet_entries', { request })
}

async function listRemoteDirectories(
  request: ListRemoteDirectoriesRequest
): Promise<RemoteDirectoryEntry[]> {
  return resolveInvoke()<RemoteDirectoryEntry[]>('list_remote_directories', { request })
}

async function pullRemoteReportletFile(
  projectDir: string,
  relativePath: string
): Promise<PrepareRemoteFileResult> {
  return resolveInvoke()<PrepareRemoteFileResult>('pull_remote_reportlet_file', {
    projectDir,
    relativePath
  })
}

async function pushLocalReportletFile(
  projectDir: string,
  relativePath: string
): Promise<PrepareRemoteFileResult> {
  return resolveInvoke()<PrepareRemoteFileResult>('push_local_reportlet_file', {
    projectDir,
    relativePath
  })
}

async function saveConfig(projectDir: string, config: ProjectConfig): Promise<void> {
  await resolveInvoke()<void>('save_project_config', { projectDir, config })
}

async function testRemoteSyncConnection(
  request: TestRemoteSyncConnectionRequest
): Promise<TestConnectionResult> {
  return resolveInvoke()<TestConnectionResult>('test_remote_sync_connection', { request })
}

export const tauriServices: ProjectConfigServices = {
  browseDirectory,
  loadConfig,
  listDesignerConnections,
  listReportletEntries,
  listRemoteReportletEntries,
  listRemoteDirectories,
  pullRemoteReportletFile,
  pushLocalReportletFile,
  saveConfig,
  testRemoteSyncConnection
}
