import { useState } from 'react'
import {
  ProjectConfigForm,
  ProjectConfigServices,
  ProjectConfigSnapshot,
  createDefaultProjectConfig
} from './components/config/project-config-form'
import {
  ChatPanel,
  ChatPanelServices
} from './components/session/chat-panel'

const DEFAULT_ENABLED_SKILLS = [
  'fr-create',
  'fr-cpt',
  'fr-fvs',
  'fr-db',
  'chrome-cdp'
]

interface AppShellProps {
  projectConfigServices?: ProjectConfigServices
  chatPanelServices?: ChatPanelServices
}

function createInitialSnapshot(): ProjectConfigSnapshot {
  return {
    config: createDefaultProjectConfig(),
    configVersion: 'v1',
    isDirty: false
  }
}

export function AppShell({
  projectConfigServices,
  chatPanelServices
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
        <ChatPanel
          projectId="default"
          projectName={snapshot.config.workspace.name}
          config={snapshot.config}
          configVersion={snapshot.configVersion}
          enabledSkills={DEFAULT_ENABLED_SKILLS}
          isConfigStale={snapshot.isDirty}
          services={chatPanelServices}
        />
      </section>
    </div>
  )
}

export default function App() {
  return <AppShell />
}
