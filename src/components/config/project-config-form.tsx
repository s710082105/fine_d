import { FormEvent, useEffect, useState } from 'react'
import { ProjectConfig, SyncProfile, WorkspaceProfile } from '../../lib/types/project-config'
import { SyncFields, WorkspaceFields } from './project-config-fields'

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>
export type ProjectConfigServices = {
  loadConfig: () => Promise<ProjectConfig>
  saveConfig: (config: ProjectConfig) => Promise<void>
}

export interface ProjectConfigSnapshot {
  config: ProjectConfig
  configVersion: string
  isDirty: boolean
}

interface ProjectConfigFormProps {
  services?: ProjectConfigServices
  onSnapshotChange?: (snapshot: ProjectConfigSnapshot) => void
}

const ALLOWED_PROTOCOLS = new Set(['sftp', 'ftp'])
const INITIAL_CONFIG_REVISION = 1

export function createDefaultProjectConfig(): ProjectConfig {
  return {
    style: { theme: 'light' },
    workspace: { name: 'default', root_dir: '' },
    sync: {
      protocol: 'sftp',
      host: '',
      port: 22,
      username: '',
      local_source_dir: '',
      remote_runtime_dir: '',
      delete_propagation: false,
      auto_sync_on_change: true
    },
    ai: { provider: 'openai', model: 'gpt-5' },
    mappings: []
  }
}

function resolveInvoke(): InvokeFn {
  const candidate = (window as { __TAURI__?: { core?: { invoke?: InvokeFn } } }).__TAURI__
  if (!candidate?.core?.invoke) {
    throw new Error('Tauri invoke is unavailable in this runtime')
  }
  return candidate.core.invoke
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function validateSync(config: ProjectConfig): string[] {
  const errors: string[] = []
  if (config.workspace.name.trim().length === 0) {
    errors.push('workspace.name is required')
  }
  if (config.workspace.root_dir.trim().length === 0) {
    errors.push('workspace.root_dir is required')
  }
  if (!ALLOWED_PROTOCOLS.has(config.sync.protocol)) {
    errors.push('protocol must be SFTP or FTP')
  }
  if (config.sync.host.trim().length === 0) {
    errors.push('sync.host is required')
  }
  if (config.sync.port <= 0) {
    errors.push('sync.port must be greater than zero')
  }
  if (config.sync.username.trim().length === 0) {
    errors.push('sync.username is required')
  }
  if (config.sync.local_source_dir.trim().length === 0) {
    errors.push('local_source_dir is required')
  }
  if (config.sync.remote_runtime_dir.trim().length === 0) {
    errors.push('remote_runtime_dir is required')
  }
  return errors
}

async function loadConfig(): Promise<ProjectConfig> {
  const invoke = resolveInvoke()
  return invoke<ProjectConfig>('load_project_config')
}

async function saveConfig(config: ProjectConfig): Promise<void> {
  const invoke = resolveInvoke()
  await invoke<void>('save_project_config', { config })
}

const tauriServices: ProjectConfigServices = {
  loadConfig,
  saveConfig
}

function createConfigVersion(revision: number, isDirty: boolean): string {
  return isDirty ? `v${revision + 1}-draft` : `v${revision}`
}

function applySyncPatch(config: ProjectConfig, patch: Partial<SyncProfile>): ProjectConfig {
  return { ...config, sync: { ...config.sync, ...patch } }
}

function applyWorkspacePatch(
  config: ProjectConfig,
  patch: Partial<WorkspaceProfile>
): ProjectConfig {
  return { ...config, workspace: { ...config.workspace, ...patch } }
}

function useProjectConfigState(
  services: ProjectConfigServices,
  onSnapshotChange?: (snapshot: ProjectConfigSnapshot) => void
) {
  const [config, setConfig] = useState<ProjectConfig>(createDefaultProjectConfig())
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [revision, setRevision] = useState(INITIAL_CONFIG_REVISION)

  useEffect(() => {
    let active = true
    void services
      .loadConfig()
      .then((saved) => {
        if (!active) return
        setConfig(saved)
        setIsDirty(false)
      })
      .catch((loadError) => {
        if (!active) return
        setError(`Failed to load project config: ${getErrorMessage(loadError)}`)
      })
    return () => {
      active = false
    }
  }, [services])

  useEffect(() => {
    onSnapshotChange?.({
      config,
      configVersion: createConfigVersion(revision, isDirty),
      isDirty
    })
  }, [config, isDirty, onSnapshotChange, revision])

  const updateConfig = (next: ProjectConfig) => {
    setConfig(next)
    setIsDirty(true)
    setError('')
    setStatus('')
  }

  const updateSync = (patch: Partial<SyncProfile>) => {
    setConfig((current) => applySyncPatch(current, patch))
    setIsDirty(true)
    setError('')
    setStatus('')
  }

  const updateWorkspace = (patch: Partial<WorkspaceProfile>) => {
    setConfig((current) => applyWorkspacePatch(current, patch))
    setIsDirty(true)
    setError('')
    setStatus('')
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setStatus('')
    const errors = validateSync(config)
    if (errors.length > 0) {
      setError(errors.join('; '))
      return
    }
    void services
      .saveConfig(config)
      .then(() => {
        setRevision((current) => current + 1)
        setIsDirty(false)
        setStatus('Saved project config')
      })
      .catch((saveError) =>
        setError(`Failed to save project config: ${getErrorMessage(saveError)}`)
      )
  }

  return { config, error, status, updateConfig, updateSync, updateWorkspace, onSubmit }
}

export function ProjectConfigForm({
  services = tauriServices,
  onSnapshotChange
}: ProjectConfigFormProps) {
  const { config, error, status, updateSync, updateWorkspace, onSubmit } =
    useProjectConfigState(services, onSnapshotChange)

  return (
    <form className="project-config-form" onSubmit={onSubmit}>
      <WorkspaceFields config={config} updateWorkspace={updateWorkspace} />
      <SyncFields config={config} updateSync={updateSync} />
      <button type="submit">Save Config</button>
      {error && <p className="form-error">{error}</p>}
      {status && <p className="form-status">{status}</p>}
    </form>
  )
}
