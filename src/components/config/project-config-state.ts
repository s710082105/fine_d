import { FormEvent, useEffect, useState } from 'react'
import {
  AiProfile,
  DataConnectionProfile,
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
  mergeConfig,
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
  const [isDirty, setIsDirty] = useState(false)
  const [revision, setRevision] = useState(INITIAL_CONFIG_REVISION)
  const [projectReady, setProjectReady] = useState(false)
  const [reportletEntries, setReportletEntries] = useState<ReportletEntry[]>([])
  const [remoteDirectoryPickerOpen, setRemoteDirectoryPickerOpen] = useState(false)
  const [remoteDirectoryLoading, setRemoteDirectoryLoading] = useState(false)
  const [remoteDirectoryEntries, setRemoteDirectoryEntries] = useState<
    RemoteDirectoryEntry[]
  >([])
  const [selectedRemoteDirectory, setSelectedRemoteDirectory] = useState('')

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

  const loadRemoteDirectories = (path: string) => {
    setRemoteDirectoryLoading(true)
    return services
      .listRemoteDirectories({
        protocol: config.sync.protocol,
        host: config.sync.host.trim(),
        port: config.sync.port,
        username: config.sync.username.trim(),
        password: config.sync.password,
        path
      })
      .finally(() => setRemoteDirectoryLoading(false))
  }

  const openRemoteDirectoryPicker = () => {
    setError('')
    const path = config.sync.remote_runtime_dir.trim() || '/'
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
    remoteDirectoryPickerOpen,
    remoteDirectoryLoading,
    remoteDirectoryEntries,
    selectedRemoteDirectory,
    chooseProjectDir,
    chooseRuntimeDir,
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
