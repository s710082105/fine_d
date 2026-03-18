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
  'finereport-template',
  'browser-validate',
  'sync-publish'
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
        <h1>Project Config</h1>
        <p>Configure sync protocol and persistence settings.</p>
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
