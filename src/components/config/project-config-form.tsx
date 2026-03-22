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
  onSnapshotChange?: (snapshot: ProjectConfigSnapshot) => void
}

interface ProjectConfigTabContext {
  config: ReturnType<typeof useProjectConfigState>['config']
  projectReady: boolean
  remoteConnectionMessage: ReturnType<
    typeof useProjectConfigState
  >['remoteConnectionMessage']
  remoteConnectionStatus: ReturnType<
    typeof useProjectConfigState
  >['remoteConnectionStatus']
  reportletEntries: ReturnType<typeof useProjectConfigState>['reportletEntries']
  reportletEntriesLoading: ReturnType<
    typeof useProjectConfigState
  >['reportletEntriesLoading']
  chooseDesignerRoot: ReturnType<typeof useProjectConfigState>['chooseDesignerRoot']
  refreshRemoteReportletEntries: ReturnType<
    typeof useProjectConfigState
  >['refreshRemoteReportletEntries']
  testRemoteSyncConnection: ReturnType<
    typeof useProjectConfigState
  >['testRemoteSyncConnection']
  testDataConnection: ReturnType<typeof useProjectConfigState>['testDataConnection']
  addDataConnection: ReturnType<typeof useProjectConfigState>['addDataConnection']
  removeDataConnection: ReturnType<typeof useProjectConfigState>['removeDataConnection']
  updateDataConnection: ReturnType<typeof useProjectConfigState>['updateDataConnection']
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
  remoteConnectionMessage,
  remoteConnectionStatus,
  reportletEntries,
  reportletEntriesLoading,
  chooseDesignerRoot,
  refreshRemoteReportletEntries,
  testRemoteSyncConnection,
  testDataConnection,
  addDataConnection,
  removeDataConnection,
  updateDataConnection,
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
          addDataConnection={addDataConnection}
          removeDataConnection={removeDataConnection}
          updateDataConnection={updateDataConnection}
          testDataConnection={testDataConnection}
        />
      )
    ),
    createTabItem(
      'files',
        '文件管理',
        projectReady,
      renderLazyTab(
        <LazyFileManagementFields
          entries={reportletEntries}
          loading={reportletEntriesLoading}
          onRefresh={refreshRemoteReportletEntries}
        />
      )
    )
  ]
}

function useProjectConfigFormViewModel(
  services: ProjectConfigServices,
  onSnapshotChange?: (snapshot: ProjectConfigSnapshot) => void
) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('project')
  const projectState = useProjectConfigState(services, onSnapshotChange)
  const tabItems = useMemo(
    () =>
      buildProjectConfigTabItems({
        config: projectState.config,
        projectReady: projectState.projectReady,
        remoteConnectionMessage: projectState.remoteConnectionMessage,
        remoteConnectionStatus: projectState.remoteConnectionStatus,
        reportletEntries: projectState.reportletEntries,
        reportletEntriesLoading: projectState.reportletEntriesLoading,
        chooseDesignerRoot: projectState.chooseDesignerRoot,
        refreshRemoteReportletEntries: projectState.refreshRemoteReportletEntries,
        testRemoteSyncConnection: projectState.testRemoteSyncConnection,
        testDataConnection: projectState.testDataConnection,
        addDataConnection: projectState.addDataConnection,
        removeDataConnection: projectState.removeDataConnection,
        updateDataConnection: projectState.updateDataConnection,
        updateAi: projectState.updateAi,
        updatePreview: projectState.updatePreview,
        updateStyle: projectState.updateStyle,
        updateSync: projectState.updateSync,
        updateWorkspace: projectState.updateWorkspace
      }),
    [projectState]
  )

  return { activeTab, setActiveTab, tabItems, ...projectState }
}

export function ProjectConfigForm({
  services = tauriServices,
  onSnapshotChange
}: ProjectConfigFormProps) {
  const {
    activeTab,
    setActiveTab,
    tabItems,
    config,
    error,
    status,
    projectReady,
    chooseProjectDir,
    onSubmit
  } = useProjectConfigFormViewModel(services, onSnapshotChange)

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
        <Button htmlType="submit" type="primary" disabled={!projectReady}>
          保存配置
        </Button>
      ) : null}
      <ProjectConfigMessages error={error} status={status} />
    </form>
  )
}
