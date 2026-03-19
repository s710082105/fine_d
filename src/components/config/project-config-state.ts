import { FormEvent, useEffect, useState } from 'react'
import {
  DataConnectionProfile,
  PreviewProfile,
  ProjectConfig,
  ReportletEntry,
  StyleProfile,
  SyncProfile,
  SyncProtocol,
  WorkspaceProfile
} from '../../lib/types/project-config'
import { ProjectConfigServices } from './project-config-services'

export interface ProjectConfigSnapshot {
  config: ProjectConfig
  configVersion: string
  isDirty: boolean
}

const ALLOWED_PROTOCOLS = new Set<SyncProtocol>(['sftp', 'ftp', 'local'])
const INITIAL_CONFIG_REVISION = 1
const REMOTE_PROTOCOLS = new Set<SyncProtocol>(['sftp', 'ftp'])

export function createDefaultProjectConfig(): ProjectConfig {
  return {
    style: {
      font_family: 'PingFang SC',
      font_size: 12,
      line_height: 1.6,
      column_width: 18,
      header_font_family: 'PingFang SC Semibold',
      header_font_size: 13,
      number_format: '#,##0.00'
    },
    workspace: { name: 'default', root_dir: '' },
    data_connections: [],
    preview: {
      url: 'http://127.0.0.1:8075/webroot/decision',
      mode: 'embedded'
    },
    sync: {
      protocol: 'sftp',
      host: '',
      port: 22,
      username: '',
      remote_runtime_dir: '',
      delete_propagation: false,
      auto_sync_on_change: true
    },
    ai: { provider: 'openai', model: 'gpt-5' },
    mappings: []
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function requiresRemoteConnection(protocol: SyncProtocol): boolean {
  return REMOTE_PROTOCOLS.has(protocol)
}

function validateConfig(config: ProjectConfig): string[] {
  const errors: string[] = []
  if (config.workspace.name.trim().length === 0) errors.push('项目名称不能为空')
  if (config.workspace.root_dir.trim().length === 0) errors.push('项目目录不能为空')
  if (!ALLOWED_PROTOCOLS.has(config.sync.protocol)) errors.push('同步协议仅支持 SFTP、FTP 或本地')
  if (config.sync.remote_runtime_dir.trim().length === 0) errors.push('运行目录不能为空')
  if (config.preview.url.trim().length === 0) errors.push('预览地址不能为空')
  if (config.style.font_family.trim().length === 0) errors.push('字体不能为空')
  if (config.style.header_font_family.trim().length === 0) errors.push('表头字体不能为空')
  if (config.style.number_format.trim().length === 0) errors.push('数字格式不能为空')
  if (config.style.font_size <= 0) errors.push('字号必须大于 0')
  if (config.style.header_font_size <= 0) errors.push('表头字号必须大于 0')
  if (config.style.line_height <= 0) errors.push('行高必须大于 0')
  if (config.style.column_width <= 0) errors.push('列宽必须大于 0')
  if (!requiresRemoteConnection(config.sync.protocol)) return errors
  if (config.sync.host.trim().length === 0) errors.push('同步主机不能为空')
  if (config.sync.port <= 0) errors.push('同步端口必须大于 0')
  if (config.sync.username.trim().length === 0) errors.push('同步用户名不能为空')
  return errors
}

function withProjectDir(config: ProjectConfig, projectDir: string): ProjectConfig {
  return {
    ...config,
    workspace: { ...config.workspace, root_dir: projectDir }
  }
}

function createProjectHint(exists: boolean): string {
  return exists
    ? '已读取项目配置文件'
    : '未发现项目配置文件，请补全后保存到项目目录'
}

export function createConfigVersion(revision: number, isDirty: boolean): string {
  return isDirty ? `v${revision + 1}-draft` : `v${revision}`
}

function mergeConfig<T extends keyof ProjectConfig>(
  config: ProjectConfig,
  key: T,
  patch: Partial<ProjectConfig[T]>
): ProjectConfig {
  return { ...config, [key]: { ...config[key], ...patch } }
}

export function useProjectConfigState(
  services: ProjectConfigServices,
  onSnapshotChange?: (snapshot: ProjectConfigSnapshot) => void
) {
  const [config, setConfig] = useState<ProjectConfig>(createDefaultProjectConfig())
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [revision, setRevision] = useState(INITIAL_CONFIG_REVISION)
  const [projectReady, setProjectReady] = useState(false)
  const [reportletEntries, setReportletEntries] = useState<ReportletEntry[]>([])

  useEffect(() => {
    onSnapshotChange?.({
      config,
      configVersion: createConfigVersion(revision, isDirty),
      isDirty
    })
  }, [config, isDirty, onSnapshotChange, revision])

  const loadReportletEntries = (projectDir: string) => {
    return services
      .listReportletEntries(projectDir)
      .then((entries) => {
        setReportletEntries(entries)
      })
      .catch((loadError) => {
        setReportletEntries([])
        throw new Error(`读取 reportlets 目录失败：${getErrorMessage(loadError)}`)
      })
  }

  const updateConfig = (next: ProjectConfig) => {
    setConfig(next)
    setIsDirty(true)
    setError('')
    setStatus('')
  }

  const commitProjectDir = (projectDir: string) => {
    const trimmed = projectDir.trim()
    setConfig((current) => withProjectDir(current, trimmed))
    setReportletEntries([])
    setError('')
    if (trimmed.length === 0) {
      setProjectReady(false)
      setStatus('')
      return
    }
    void services
      .loadConfig(trimmed)
      .then((result) => {
        setConfig(withProjectDir(result.config, trimmed))
        setProjectReady(true)
        setIsDirty(!result.exists)
        setStatus(createProjectHint(result.exists))
        return loadReportletEntries(trimmed)
      })
      .catch((loadError) => {
        const message = getErrorMessage(loadError)
        const isConfigError = message.startsWith('读取 reportlets 目录失败：')
        if (!isConfigError) {
          setProjectReady(false)
        }
        setError(isConfigError ? message : `读取项目配置失败：${message}`)
      })
  }

  const chooseProjectDir = () => {
    setError('')
    void services
      .browseDirectory()
      .then((projectDir) => {
        if (!projectDir) return
        commitProjectDir(projectDir)
      })
      .catch((browseError) =>
        setError(`选择项目目录失败：${getErrorMessage(browseError)}`)
      )
  }

  const chooseRuntimeDir = () => {
    setError('')
    void services
      .browseDirectory()
      .then((runtimeDir) => {
        if (!runtimeDir) return
        updateConfig(mergeConfig(config, 'sync', { remote_runtime_dir: runtimeDir }))
      })
      .catch((browseError) =>
        setError(`选择运行目录失败：${getErrorMessage(browseError)}`)
      )
  }

  const updateWorkspace = (patch: Partial<WorkspaceProfile>) =>
    updateConfig(mergeConfig(config, 'workspace', patch))
  const updateDataConnection = (
    index: number,
    patch: Partial<DataConnectionProfile>
  ) => {
    const nextConnections = [...config.data_connections]
    const current = nextConnections[index] ?? {
      connection_name: '',
      dsn: '',
      username: '',
      password: ''
    }
    nextConnections[index] = { ...current, ...patch }
    updateConfig({ ...config, data_connections: nextConnections })
  }
  const addDataConnection = () => {
    const nextConnections =
      config.data_connections.length > 0
        ? [...config.data_connections]
        : [{ connection_name: '', dsn: '', username: '', password: '' }]
    nextConnections.push({
      connection_name: '',
      dsn: '',
      username: '',
      password: ''
    })
    updateConfig({ ...config, data_connections: nextConnections })
  }
  const removeDataConnection = (index: number) =>
    updateConfig({
      ...config,
      data_connections: config.data_connections.filter((_, itemIndex) => itemIndex !== index)
    })
  const updatePreview = (patch: Partial<PreviewProfile>) =>
    updateConfig(mergeConfig(config, 'preview', patch))
  const updateSync = (patch: Partial<SyncProfile>) =>
    updateConfig(mergeConfig(config, 'sync', patch))
  const updateStyle = (patch: Partial<StyleProfile>) =>
    updateConfig(mergeConfig(config, 'style', patch))

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setStatus('')
    const errors = validateConfig(config)
    if (errors.length > 0) {
      setError(errors.join('；'))
      return
    }
    const projectDir = config.workspace.root_dir.trim()
    void services
      .saveConfig(projectDir, config)
      .then(() => {
        setRevision((current) => current + 1)
        setIsDirty(false)
        setProjectReady(true)
        setStatus('项目配置已保存')
        return loadReportletEntries(projectDir)
      })
      .catch((saveError) =>
        setError(`保存项目配置失败：${getErrorMessage(saveError)}`)
      )
  }

  return {
    config,
    error,
    status,
    projectReady,
    reportletEntries,
    chooseProjectDir,
    chooseRuntimeDir,
    addDataConnection,
    removeDataConnection,
    updateDataConnection,
    updateWorkspace,
    updatePreview,
    updateSync,
    updateStyle,
    onSubmit
  }
}
