import { Alert, Button, Input, Space, Tabs } from 'antd'
import type { TabsProps } from 'antd'
import type { ReactNode } from 'react'
import { Suspense, lazy, useMemo, useState } from 'react'
import { resolveProjectSourceDir } from '../../lib/types/project-config'
import { ProjectFields } from './project-config-project-fields'
import {
  ProjectConfigSnapshot,
  useProjectConfigState
} from './project-config-state'
import {
  ProjectConfigServices,
  tauriServices
} from './project-config-services'

type ConfigTab = 'project' | 'style' | 'data' | 'files'

interface ProjectConfigFormProps {
  services?: ProjectConfigServices
  canInsertLocalPath?: boolean
  onInsertLocalPath?: (path: string) => void
  onSnapshotChange?: (snapshot: ProjectConfigSnapshot) => void
}

interface ProjectConfigTabContext {
  config: ReturnType<typeof useProjectConfigState>['config']
  projectReady: boolean
  designerConnections: ReturnType<typeof useProjectConfigState>['designerConnections']
  designerConnectionsLoading: ReturnType<
    typeof useProjectConfigState
  >['designerConnectionsLoading']
  remoteConnectionMessage: ReturnType<
    typeof useProjectConfigState
  >['remoteConnectionMessage']
  remoteConnectionStatus: ReturnType<
    typeof useProjectConfigState
  >['remoteConnectionStatus']
  localReportletEntries: ReturnType<typeof useProjectConfigState>['localReportletEntries']
  remoteReportletEntries: ReturnType<typeof useProjectConfigState>['remoteReportletEntries']
  remoteReportletEntriesLoading: ReturnType<
    typeof useProjectConfigState
  >['remoteReportletEntriesLoading']
  remoteReportletPulling: ReturnType<
    typeof useProjectConfigState
  >['remoteReportletPulling']
  localReportletPushing: ReturnType<
    typeof useProjectConfigState
  >['localReportletPushing']
  canInsertLocalPath: boolean
  chooseDesignerRoot: ReturnType<typeof useProjectConfigState>['chooseDesignerRoot']
  refreshDesignerConnections: ReturnType<
    typeof useProjectConfigState
  >['refreshDesignerConnections']
  loadLocalReportletChildren: ReturnType<
    typeof useProjectConfigState
  >['loadLocalReportletChildren']
  loadRemoteReportletChildren: ReturnType<
    typeof useProjectConfigState
  >['loadRemoteReportletChildren']
  refreshRemoteReportletEntries: ReturnType<
    typeof useProjectConfigState
  >['refreshRemoteReportletEntries']
  onInsertLocalPath?: (path: string) => void
  pullRemoteReportletFile: ReturnType<
    typeof useProjectConfigState
  >['pullRemoteReportletFile']
  pushLocalReportletFile: ReturnType<
    typeof useProjectConfigState
  >['pushLocalReportletFile']
  testRemoteSyncConnection: ReturnType<
    typeof useProjectConfigState
  >['testRemoteSyncConnection']
  updateAi: ReturnType<typeof useProjectConfigState>['updateAi']
  updatePreview: ReturnType<typeof useProjectConfigState>['updatePreview']
  updateStyle: ReturnType<typeof useProjectConfigState>['updateStyle']
  updateSync: ReturnType<typeof useProjectConfigState>['updateSync']
  updateWorkspace: ReturnType<typeof useProjectConfigState>['updateWorkspace']
}

const LazyFileManagementFields = lazy(() =>
  import('./project-config-file-management-fields').then((module) => ({
    default: module.FileManagementFields
  }))
)
const LazyStyleFields = lazy(() =>
  import('./project-config-style-fields').then((module) => ({
    default: module.StyleFields
  }))
)
const LazyDataConnectionFields = lazy(() =>
  import('./project-config-extra-fields').then((module) => ({
    default: module.DataConnectionFields
  }))
)

export { createDefaultProjectConfig } from './project-config-state'
export type { ProjectConfigSnapshot } from './project-config-state'
export type { ProjectConfigServices } from './project-config-services'

function ProjectDirectoryField({
  rootDir,
  chooseProjectDir
}: {
  rootDir: string
  chooseProjectDir: () => void
}) {
  return (
    <label className="config-field">
      <span className="config-field__label">项目目录</span>
      <Space.Compact block>
        <Input aria-label="项目目录" value={rootDir} readOnly />
        <Button type="default" onClick={chooseProjectDir}>
          选择项目目录
        </Button>
      </Space.Compact>
    </label>
  )
}

function ProjectConfigMessages({
  error,
  status
}: {
  error: string | null
  status: string | null
}) {
  return (
    <div className="project-config-form__messages">
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {status ? <Alert type="success" showIcon message={status} /> : null}
    </div>
  )
}

function createTabItem(
  key: ConfigTab,
  label: string,
  projectReady: boolean,
  children: ReactNode
): NonNullable<TabsProps['items']>[number] {
  return {
    key,
    label,
    disabled: !projectReady,
    children: projectReady ? children : null
  }
}

function renderLazyTab(children: ReactNode) {
  return <Suspense fallback={<p className="form-hint">加载中...</p>}>{children}</Suspense>
}

function buildProjectConfigTabItems({
  config,
  projectReady,
  designerConnections,
  designerConnectionsLoading,
  remoteConnectionMessage,
  remoteConnectionStatus,
  localReportletEntries,
  remoteReportletEntries,
  remoteReportletEntriesLoading,
  remoteReportletPulling,
  localReportletPushing,
  canInsertLocalPath,
  chooseDesignerRoot,
  refreshDesignerConnections,
  loadLocalReportletChildren,
  loadRemoteReportletChildren,
  refreshRemoteReportletEntries,
  onInsertLocalPath,
  pullRemoteReportletFile,
  pushLocalReportletFile,
  testRemoteSyncConnection,
  updateAi,
  updatePreview,
  updateStyle,
  updateSync,
  updateWorkspace
}: ProjectConfigTabContext): TabsProps['items'] {
  return [
    createTabItem(
      'project',
      '项目',
      projectReady,
      <>
        <ProjectFields
          config={config}
          chooseDesignerRoot={chooseDesignerRoot}
          remoteConnectionMessage={remoteConnectionMessage}
          remoteConnectionStatus={remoteConnectionStatus}
          testRemoteSyncConnection={testRemoteSyncConnection}
          updateWorkspace={updateWorkspace}
          updateSync={updateSync}
          updatePreview={updatePreview}
          updateAi={updateAi}
        />
        <p className="form-hint">{`真实同步源目录固定为：${resolveProjectSourceDir(config.workspace.root_dir)}`}</p>
      </>
    ),
    createTabItem(
      'style',
      '样式',
      projectReady,
      renderLazyTab(<LazyStyleFields config={config} updateStyle={updateStyle} />)
    ),
    createTabItem(
      'data',
      '数据连接',
      projectReady,
      renderLazyTab(
        <LazyDataConnectionFields
          config={config}
          connections={designerConnections}
          loading={designerConnectionsLoading}
          refreshConnections={refreshDesignerConnections}
        />
      )
    ),
    createTabItem(
      'files',
      '文件管理',
      projectReady,
      renderLazyTab(
        <LazyFileManagementFields
          canInsertLocalPath={canInsertLocalPath}
          localEntries={localReportletEntries}
          onInsertLocalPath={onInsertLocalPath}
          onLoadLocalChildren={loadLocalReportletChildren}
          onLoadRemoteChildren={loadRemoteReportletChildren}
          remoteEntries={remoteReportletEntries}
          localPushing={localReportletPushing}
          remoteLoading={remoteReportletEntriesLoading}
          remotePulling={remoteReportletPulling}
          onRefresh={refreshRemoteReportletEntries}
          onPullRemoteFile={pullRemoteReportletFile}
          onPushLocalFile={pushLocalReportletFile}
        />
      )
    )
  ]
}

function useProjectConfigFormViewModel(
  services: ProjectConfigServices,
  canInsertLocalPath = false,
  onInsertLocalPath?: (path: string) => void,
  onSnapshotChange?: (snapshot: ProjectConfigSnapshot) => void
) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('project')
  const projectState = useProjectConfigState(services, onSnapshotChange)
  const tabItems = useMemo(
    () =>
      buildProjectConfigTabItems({
        config: projectState.config,
        projectReady: projectState.projectReady,
        designerConnections: projectState.designerConnections,
        designerConnectionsLoading: projectState.designerConnectionsLoading,
        remoteConnectionMessage: projectState.remoteConnectionMessage,
        remoteConnectionStatus: projectState.remoteConnectionStatus,
        localReportletEntries: projectState.localReportletEntries,
        remoteReportletEntries: projectState.remoteReportletEntries,
        remoteReportletEntriesLoading: projectState.remoteReportletEntriesLoading,
        remoteReportletPulling: projectState.remoteReportletPulling,
        localReportletPushing: projectState.localReportletPushing,
        canInsertLocalPath,
        chooseDesignerRoot: projectState.chooseDesignerRoot,
        refreshDesignerConnections: projectState.refreshDesignerConnections,
        loadLocalReportletChildren: projectState.loadLocalReportletChildren,
        loadRemoteReportletChildren: projectState.loadRemoteReportletChildren,
        refreshRemoteReportletEntries: projectState.refreshRemoteReportletEntries,
        onInsertLocalPath,
        pullRemoteReportletFile: projectState.pullRemoteReportletFile,
        pushLocalReportletFile: projectState.pushLocalReportletFile,
        testRemoteSyncConnection: projectState.testRemoteSyncConnection,
        updateAi: projectState.updateAi,
        updatePreview: projectState.updatePreview,
        updateStyle: projectState.updateStyle,
        updateSync: projectState.updateSync,
        updateWorkspace: projectState.updateWorkspace
      }),
    [canInsertLocalPath, onInsertLocalPath, projectState]
  )

  return { activeTab, setActiveTab, tabItems, ...projectState }
}

export function ProjectConfigForm({
  services = tauriServices,
  canInsertLocalPath = false,
  onInsertLocalPath,
  onSnapshotChange
}: ProjectConfigFormProps) {
  const {
    activeTab,
    setActiveTab,
    tabItems,
    config,
    error,
    isSaving,
    status,
    projectReady,
    chooseProjectDir,
    onSubmit
  } = useProjectConfigFormViewModel(
    services,
    canInsertLocalPath,
    onInsertLocalPath,
    onSnapshotChange
  )

  return (
    <form className="project-config-form" onSubmit={onSubmit}>
      <ProjectDirectoryField
        rootDir={config.workspace.root_dir}
        chooseProjectDir={chooseProjectDir}
      />
      {!projectReady && !error && (
        <p className="form-hint">先选择项目目录，再读取或创建项目配置文件。</p>
      )}
      <Tabs
        className="config-tabs"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as ConfigTab)}
        items={tabItems}
      />
      {activeTab !== 'files' ? (
        <Button htmlType="submit" type="primary" disabled={!projectReady || isSaving} loading={isSaving}>
          {isSaving ? '保存中...' : '保存配置'}
        </Button>
      ) : null}
      <ProjectConfigMessages error={error} status={status} />
    </form>
  )
}
