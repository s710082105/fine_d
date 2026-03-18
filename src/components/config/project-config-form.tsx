import { FormEvent, useEffect, useState } from 'react'
import { ProjectConfig, SyncProfile } from '../../lib/types/project-config'

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>
type ProjectConfigServices = {
  loadConfig: () => Promise<ProjectConfig>
  saveConfig: (config: ProjectConfig) => Promise<void>
}

const ALLOWED_PROTOCOLS = new Set(['sftp', 'ftp'])

export function createDefaultProjectConfig(): ProjectConfig {
  return {
    style: { theme: 'light' },
    workspace: { name: 'default', root_dir: '' },
    sync: {
      protocol: 'sftp',
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
  if (!ALLOWED_PROTOCOLS.has(config.sync.protocol)) {
    errors.push('protocol must be SFTP or FTP')
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

function applySyncPatch(config: ProjectConfig, patch: Partial<SyncProfile>): ProjectConfig {
  return { ...config, sync: { ...config.sync, ...patch } }
}

function useProjectConfigState(services: ProjectConfigServices) {
  const [config, setConfig] = useState<ProjectConfig>(createDefaultProjectConfig())
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    let active = true
    void services
      .loadConfig()
      .then((saved) => {
        if (!active) return
        setConfig(saved)
      })
      .catch((loadError) => {
        if (!active) return
        setError(`Failed to load project config: ${getErrorMessage(loadError)}`)
      })
    return () => {
      active = false
    }
  }, [services])

  const updateSync = (patch: Partial<SyncProfile>) => {
    setConfig((current) => applySyncPatch(current, patch))
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
      .then(() => setStatus('Saved project config'))
      .catch((saveError) =>
        setError(`Failed to save project config: ${getErrorMessage(saveError)}`)
      )
  }

  return { config, error, status, updateSync, onSubmit }
}

interface SyncFieldProps {
  config: ProjectConfig
  updateSync: (patch: Partial<SyncProfile>) => void
}

function SyncFields({ config, updateSync }: SyncFieldProps) {
  return (
    <>
      <label>
        Protocol
        <select
          value={config.sync.protocol}
          onChange={(event) =>
            updateSync({ protocol: event.target.value as 'sftp' | 'ftp' })
          }
        >
          <option value="sftp">SFTP</option>
          <option value="ftp">FTP</option>
        </select>
      </label>
      <label>
        Local Source Dir
        <input
          type="text"
          value={config.sync.local_source_dir}
          onChange={(event) => updateSync({ local_source_dir: event.target.value })}
        />
      </label>
      <label>
        Remote Runtime Dir
        <input
          type="text"
          value={config.sync.remote_runtime_dir}
          onChange={(event) => updateSync({ remote_runtime_dir: event.target.value })}
        />
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={config.sync.delete_propagation}
          onChange={(event) => updateSync({ delete_propagation: event.target.checked })}
        />
        Delete Propagation
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={config.sync.auto_sync_on_change}
          onChange={(event) => updateSync({ auto_sync_on_change: event.target.checked })}
        />
        Auto Sync On Change
      </label>
    </>
  )
}

interface ProjectConfigFormProps {
  services?: ProjectConfigServices
}

export function ProjectConfigForm({ services = tauriServices }: ProjectConfigFormProps) {
  const { config, error, status, updateSync, onSubmit } = useProjectConfigState(services)

  return (
    <form className="project-config-form" onSubmit={onSubmit}>
      <SyncFields config={config} updateSync={updateSync} />
      <button type="submit">Save Config</button>
      {error && <p className="form-error">{error}</p>}
      {status && <p className="form-status">{status}</p>}
    </form>
  )
}
