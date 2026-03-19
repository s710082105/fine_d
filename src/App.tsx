import { useState } from 'react'
import {
  ProjectConfigForm,
  ProjectConfigServices,
  ProjectConfigSnapshot,
  createDefaultProjectConfig
} from './components/config/project-config-form'
import { TerminalPanel } from './components/terminal/terminal-panel'
import type { TerminalServices } from './components/terminal/terminal-services'
import type { TerminalAdapterFactory } from './components/terminal/xterm-adapter'

interface AppShellProps {
  projectConfigServices?: ProjectConfigServices
  terminalServices?: TerminalServices
  terminalAdapterFactory?: TerminalAdapterFactory
}

function createInitialSnapshot(): ProjectConfigSnapshot {
  return {
    config: createDefaultProjectConfig(),
    configVersion: 'v1',
    isDirty: false
  }
}

function resolveTerminalProjectId(snapshot: ProjectConfigSnapshot): string {
  const workspaceRoot = snapshot.config.workspace.root_dir.trim()

  if (workspaceRoot.length > 0) {
    return workspaceRoot
  }

  return `${snapshot.config.workspace.name.trim()}::${snapshot.configVersion}`
}

export function AppShell({
  projectConfigServices,
  terminalServices,
  terminalAdapterFactory
}: AppShellProps) {
  const [snapshot, setSnapshot] = useState<ProjectConfigSnapshot>(createInitialSnapshot)

  return (
    <div className="app-shell">
      <section className="pane pane-left">
        <h1>项目配置</h1>
        <p>在左侧切换项目、样式、数据连接和文件管理，Codex 改动完成后由系统自动同步到运行目录。</p>
        <ProjectConfigForm
          services={projectConfigServices}
          onSnapshotChange={setSnapshot}
        />
      </section>
      <section className="pane pane-right">
        <TerminalPanel
          projectId={resolveTerminalProjectId(snapshot)}
          projectName={snapshot.config.workspace.name}
          config={snapshot.config}
          configVersion={snapshot.configVersion}
          isConfigStale={snapshot.isDirty}
          services={terminalServices}
          createAdapter={terminalAdapterFactory}
        />
      </section>
    </div>
  )
}

export default function App() {
  return <AppShell />
}
