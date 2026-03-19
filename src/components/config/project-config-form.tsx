import { useState } from 'react'
import { resolveProjectSourceDir } from '../../lib/types/project-config'
import { ProjectFields, StyleFields } from './project-config-fields'
import {
  DataConnectionFields,
  FileManagementFields
} from './project-config-extra-fields'
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

export { createDefaultProjectConfig } from './project-config-state'
export type { ProjectConfigSnapshot } from './project-config-state'
export type { ProjectConfigServices } from './project-config-services'

export function ProjectConfigForm({
  services = tauriServices,
  onSnapshotChange
}: ProjectConfigFormProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('project')
  const {
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
    updateAi,
    updatePreview,
    updateStyle,
    updateSync,
    updateWorkspace,
    onSubmit
  } =
    useProjectConfigState(services, onSnapshotChange)

  return (
    <form className="project-config-form" onSubmit={onSubmit}>
      <label>
        项目目录
        <div className="directory-picker">
          <input type="text" value={config.workspace.root_dir} readOnly />
          <button type="button" onClick={chooseProjectDir}>
            选择项目目录
          </button>
        </div>
      </label>
      {!projectReady && !error && (
        <p className="form-hint">先选择项目目录，再读取或创建项目配置文件。</p>
      )}
      <div className="config-tabs" role="tablist" aria-label="配置分组">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'project'}
          className={activeTab === 'project' ? 'config-tab is-active' : 'config-tab'}
          onClick={() => setActiveTab('project')}
          disabled={!projectReady}
        >
          项目
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'style'}
          className={activeTab === 'style' ? 'config-tab is-active' : 'config-tab'}
          onClick={() => setActiveTab('style')}
          disabled={!projectReady}
        >
          样式
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'data'}
          className={activeTab === 'data' ? 'config-tab is-active' : 'config-tab'}
          onClick={() => setActiveTab('data')}
          disabled={!projectReady}
        >
          数据连接
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'files'}
          className={activeTab === 'files' ? 'config-tab is-active' : 'config-tab'}
          onClick={() => setActiveTab('files')}
          disabled={!projectReady}
        >
          文件管理
        </button>
      </div>
      {projectReady && activeTab === 'project' ? (
        <>
          <ProjectFields
            config={config}
            chooseRuntimeDir={chooseRuntimeDir}
            updateWorkspace={updateWorkspace}
            updateSync={updateSync}
            updatePreview={updatePreview}
            updateAi={updateAi}
          />
          <p className="form-hint">{`真实同步源目录固定为：${resolveProjectSourceDir(config.workspace.root_dir)}`}</p>
        </>
      ) : null}
      {projectReady && activeTab === 'style' ? (
        <StyleFields config={config} updateStyle={updateStyle} />
      ) : null}
      {projectReady && activeTab === 'data' ? (
        <DataConnectionFields
          config={config}
          addDataConnection={addDataConnection}
          removeDataConnection={removeDataConnection}
          updateDataConnection={updateDataConnection}
        />
      ) : null}
      {projectReady && activeTab === 'files' ? (
        <FileManagementFields entries={reportletEntries} />
      ) : null}
      <button type="submit" disabled={!projectReady}>保存配置</button>
      {error && <p className="form-error">{error}</p>}
      {status && <p className="form-status">{status}</p>}
    </form>
  )
}
