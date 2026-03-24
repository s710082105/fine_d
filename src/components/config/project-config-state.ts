import { FormEvent, useEffect, useState } from 'react'
import {
  AiProfile,
  DataConnectionProfile,
  FIXED_REMOTE_RUNTIME_DIR,
  PreviewProfile,
  ProjectConfig,
  RemoteDirectoryEntry,
  ReportletEntry,
  StyleProfile,
  SyncProfile,
  WorkspaceProfile
} from '../../lib/types/project-config'
import { ProjectConfigServices } from './project-config-services'
import {
  createDefaultProjectConfig,
  createProjectHint,
  initializeReportletEntries,
  mergeConfig,
  mergeReportletChildren,
  mergeRemoteDirectoryChildren,
  validateConfig,
  withProjectDir
} from './project-config-state-helpers'

export interface ProjectConfigSnapshot {
  config: ProjectConfig
  configVersion: string
  isDirty: boolean
}

export { createDefaultProjectConfig } from './project-config-state-helpers'

const INITIAL_CONFIG_REVISION = 1

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createConfigVersion(revision: number, isDirty: boolean): string {
  return isDirty ? `v${revision + 1}-draft` : `v${revision}`
}

export function useProjectConfigState(
  services: ProjectConfigServices,
  onSnapshotChange?: (snapshot: ProjectConfigSnapshot) => void
) {
  const [config, setConfig] = useState<ProjectConfig>(createDefaultProjectConfig())
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [revision, setRevision] = useState(INITIAL_CONFIG_REVISION)
  const [projectReady, setProjectReady] = useState(false)
  const [localReportletEntries, setLocalReportletEntries] = useState<ReportletEntry[]>([])
  const [remoteReportletEntries, setRemoteReportletEntries] = useState<ReportletEntry[]>([])
  const [remoteReportletEntriesLoading, setRemoteReportletEntriesLoading] = useState(false)
  const [remoteReportletPulling, setRemoteReportletPulling] = useState(false)
  const [remoteDirectoryPickerOpen, setRemoteDirectoryPickerOpen] = useState(false)
  const [remoteDirectoryLoading, setRemoteDirectoryLoading] = useState(false)
  const [remoteDirectoryEntries, setRemoteDirectoryEntries] = useState<
    RemoteDirectoryEntry[]
  >([])
  const [selectedRemoteDirectory, setSelectedRemoteDirectory] = useState('')
  const [remoteConnectionStatus, setRemoteConnectionStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [remoteConnectionMessage, setRemoteConnectionMessage] = useState('')

  useEffect(() => {
    onSnapshotChange?.({
      config,
      configVersion: createConfigVersion(revision, isDirty),
      isDirty
    })
  }, [config, isDirty, onSnapshotChange, revision])

  const loadReportletEntries = (projectDir: string, relativePath?: string) => {
    return services
      .listReportletEntries(projectDir, relativePath)
      .then((entries) => {
        const normalized = initializeReportletEntries(entries)
        if (relativePath && relativePath.trim().length > 0) {
          setLocalReportletEntries((current) =>
            mergeReportletChildren(current, relativePath, normalized)
          )
          return normalized
        }
        setLocalReportletEntries(normalized)
        return normalized
      })
      .catch((loadError) => {
        if (!relativePath) {
          setLocalReportletEntries([])
        }
        throw new Error(`读取 reportlets 目录失败：${getErrorMessage(loadError)}`)
      })
  }

  const refreshRemoteReportletEntries = () => {
    setError('')
    setStatus('')
    setRemoteReportletEntriesLoading(true)
    return services
      .listRemoteReportletEntries({
        designerRoot: config.sync.designer_root.trim(),
        url: config.preview.url.trim(),
        username: config.preview.account.trim(),
        password: config.preview.password,
        path: FIXED_REMOTE_RUNTIME_DIR
      })
      .then((entries) => {
        setRemoteReportletEntries(initializeReportletEntries(entries))
        setStatus('已读取远程 reportlets 文件清单')
        return entries
      })
      .catch((loadError) => {
        setError(`读取远程 reportlets 失败：${getErrorMessage(loadError)}`)
        throw loadError
      })
      .finally(() => setRemoteReportletEntriesLoading(false))
  }

  const pullRemoteReportletFile = (relativePath: string) => {
    const projectDir = config.workspace.root_dir.trim()
    if (projectDir.length === 0) {
      return Promise.reject(new Error('请先选择项目目录'))
    }
    setError('')
    setStatus('')
    setRemoteReportletPulling(true)
    return services
      .pullRemoteReportletFile(projectDir, relativePath)
      .then((result) => {
        setStatus(result.message)
        return loadReportletEntries(projectDir).then(() => result)
      })
      .catch((pullError) => {
        setError(`拉取远端文件失败：${getErrorMessage(pullError)}`)
        throw pullError
      })
      .finally(() => setRemoteReportletPulling(false))
  }

  const updateConfig = (next: ProjectConfig) => {
    setConfig(next)
    setIsDirty(true)
    setError('')
    setStatus('')
    setRemoteConnectionStatus('idle')
    setRemoteConnectionMessage('')
  }

  const commitProjectDir = (projectDir: string) => {
    const trimmed = projectDir.trim()
    setConfig((current) => withProjectDir(current, trimmed))
    setLocalReportletEntries([])
    setRemoteReportletEntries([])
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

  const chooseDesignerRoot = () => {
    setError('')
    void services
      .browseDirectory()
      .then((designerRoot) => {
        if (!designerRoot) return
        updateConfig(mergeConfig(config, 'sync', { designer_root: designerRoot }))
      })
      .catch((browseError) =>
        setError(`选择本地设计器目录失败：${getErrorMessage(browseError)}`)
      )
  }

  const loadLocalReportletChildren = (relativePath: string) => {
    const projectDir = config.workspace.root_dir.trim()
    if (projectDir.length === 0) {
      return Promise.reject(new Error('请先选择项目目录'))
    }
    return loadReportletEntries(projectDir, relativePath)
  }

  const loadRemoteDirectories = (path: string) => {
    setRemoteDirectoryLoading(true)
    return services
      .listRemoteDirectories({
        designerRoot: config.sync.designer_root.trim(),
        url: config.preview.url.trim(),
        username: config.preview.account.trim(),
        password: config.preview.password,
        path
      })
      .finally(() => setRemoteDirectoryLoading(false))
  }

  const testRemoteSyncConnection = () => {
    setRemoteConnectionStatus('loading')
    setRemoteConnectionMessage('')
    const path = config.sync.remote_runtime_dir.trim() || FIXED_REMOTE_RUNTIME_DIR
    return services
      .testRemoteSyncConnection({
        designerRoot: config.sync.designer_root.trim(),
        url: config.preview.url.trim(),
        username: config.preview.account.trim(),
        password: config.preview.password,
        path
      })
      .then((result) => {
        setRemoteConnectionStatus(result.ok ? 'success' : 'error')
        setRemoteConnectionMessage(result.message)
        return result
      })
      .catch((testError) => {
        const message = getErrorMessage(testError)
        setRemoteConnectionStatus('error')
        setRemoteConnectionMessage(message)
        throw testError
      })
  }

  const openRemoteDirectoryPicker = () => {
    setError('')
    const path = config.sync.remote_runtime_dir.trim() || FIXED_REMOTE_RUNTIME_DIR
    void loadRemoteDirectories(path)
      .then((entries) => {
        setRemoteDirectoryEntries(entries)
        setSelectedRemoteDirectory(path)
        setRemoteDirectoryPickerOpen(true)
      })
      .catch((loadError) =>
        setError(`读取远程目录失败：${getErrorMessage(loadError)}`)
      )
  }

  const closeRemoteDirectoryPicker = () => {
    setRemoteDirectoryPickerOpen(false)
    setRemoteDirectoryLoading(false)
  }

  const loadRemoteDirectoryChildren = (path: string) => {
    return loadRemoteDirectories(path)
      .then((children) => {
        setRemoteDirectoryEntries((current) =>
          mergeRemoteDirectoryChildren(current, path, children)
        )
      })
      .catch((loadError) => {
        setError(`读取远程目录失败：${getErrorMessage(loadError)}`)
        throw loadError
      })
  }

  const confirmRemoteDirectory = () => {
    if (selectedRemoteDirectory.trim().length === 0) return
    updateConfig(
      mergeConfig(config, 'sync', { remote_runtime_dir: selectedRemoteDirectory })
    )
    setRemoteDirectoryPickerOpen(false)
  }

  const loadRemoteReportletChildren = (path: string) => {
    return services
      .listRemoteReportletEntries({
        designerRoot: config.sync.designer_root.trim(),
        url: config.preview.url.trim(),
        username: config.preview.account.trim(),
        password: config.preview.password,
        path
      })
      .then((entries) => {
        const normalized = initializeReportletEntries(entries)
        setRemoteReportletEntries((current) =>
          mergeReportletChildren(current, path, normalized)
        )
        return normalized
      })
      .catch((loadError) => {
        setError(`读取远程 reportlets 失败：${getErrorMessage(loadError)}`)
        throw loadError
      })
  }

  const updateWorkspace = (patch: Partial<WorkspaceProfile>) =>
    updateConfig(mergeConfig(config, 'workspace', patch))
  const updateDataConnection = (
    index: number,
    conn: DataConnectionProfile
  ) => {
    const nextConnections = [...config.data_connections]
    nextConnections[index] = conn
    updateConfig({ ...config, data_connections: nextConnections })
  }
  const addDataConnection = (conn: DataConnectionProfile) => {
    updateConfig({ ...config, data_connections: [...config.data_connections, conn] })
  }
  const removeDataConnection = (index: number) =>
    updateConfig({
      ...config,
      data_connections: config.data_connections.filter((_, itemIndex) => itemIndex !== index)
    })
  const updatePreview = (patch: Partial<PreviewProfile>) =>
    updateConfig(mergeConfig(config, 'preview', patch))
  const updateAi = (patch: Partial<AiProfile>) =>
    updateConfig(mergeConfig(config, 'ai', patch))
  const updateSync = (patch: Partial<SyncProfile>) =>
    updateConfig(mergeConfig(config, 'sync', patch))
  const updateStyle = (patch: Partial<StyleProfile>) =>
    updateConfig(mergeConfig(config, 'style', patch))
  const testDataConnection = (conn: DataConnectionProfile) =>
    services.testDataConnection(conn)

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving) {
      return
    }
    setError('')
    setStatus('')
    const errors = validateConfig(config)
    if (errors.length > 0) {
      setError(errors.join('；'))
      return
    }
    const projectDir = config.workspace.root_dir.trim()
    setIsSaving(true)
    setStatus('正在保存项目配置...')
    void services
      .saveConfig(projectDir, config)
      .then(() => {
        setRevision((current) => current + 1)
        setIsDirty(false)
        setProjectReady(true)
        setStatus('项目配置已保存')
        return loadReportletEntries(projectDir)
      })
      .catch((saveError) => {
        setStatus('')
        setError(`保存项目配置失败：${getErrorMessage(saveError)}`)
      })
      .finally(() => setIsSaving(false))
  }

  return {
    config,
    error,
    isSaving,
    status,
    remoteConnectionStatus,
    remoteConnectionMessage,
    projectReady,
    localReportletEntries,
    remoteReportletEntries,
    remoteReportletEntriesLoading,
    remoteReportletPulling,
    remoteDirectoryPickerOpen,
    remoteDirectoryLoading,
    remoteDirectoryEntries,
    selectedRemoteDirectory,
    chooseProjectDir,
    chooseDesignerRoot,
    refreshRemoteReportletEntries,
    pullRemoteReportletFile,
    loadLocalReportletChildren,
    loadRemoteReportletChildren,
    testRemoteSyncConnection,
    openRemoteDirectoryPicker,
    closeRemoteDirectoryPicker,
    loadRemoteDirectoryChildren,
    selectRemoteDirectory: setSelectedRemoteDirectory,
    confirmRemoteDirectory,
    addDataConnection,
    removeDataConnection,
    updateDataConnection,
    updateWorkspace,
    updatePreview,
    updateAi,
    updateSync,
    updateStyle,
    testDataConnection,
    onSubmit
  }
}
