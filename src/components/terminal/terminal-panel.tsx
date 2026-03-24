import { useEffect } from 'react'
import type { ProjectConfig } from '../../lib/types/project-config'
import { getTerminalStatusLabel } from './terminal-state'
import {
  TerminalPanelBody,
  TerminalPanelHeader
} from './terminal-panel-sections'
import type { TerminalServices } from './terminal-services'
import type { TerminalAdapterFactory } from './xterm-adapter'
import { useTerminalPanelController } from './use-terminal-panel-controller'

export interface TerminalInputBridge {
  canWriteInput: boolean
  writeInput: (payload: string) => void
}

export interface TerminalPanelProps {
  projectId: string
  projectName: string
  config: ProjectConfig
  configVersion: string
  isConfigStale: boolean
  onInputBridgeChange?: (bridge: TerminalInputBridge) => void
  services?: TerminalServices
  createAdapter?: TerminalAdapterFactory
}

export function TerminalPanel(props: TerminalPanelProps) {
  const controller = useTerminalPanelController(props)

  useEffect(() => {
    controller.refreshTerminal()
  }, [
    controller,
    props.isConfigStale,
    props.projectName,
    props.configVersion,
    controller.errorMessage,
    controller.idleHint,
    controller.installMessage,
    controller.status
  ])

  useEffect(() => {
    props.onInputBridgeChange?.({
      canWriteInput: controller.canWriteInput,
      writeInput: controller.writeInput
    })
  }, [controller.canWriteInput, controller.writeInput, props.onInputBridgeChange])

  return (
    <section className="terminal-panel session-card" data-project-id={props.projectId}>
      <TerminalPanelHeader
        canStart={controller.canStart}
        onClose={controller.closeTerminal}
        onRestart={controller.restartTerminal}
        onStart={controller.startTerminal}
        statusLabel={getTerminalStatusLabel(controller.status)}
        projectName={props.projectName}
        configVersion={props.configVersion}
        workspaceRoot={controller.workspaceRoot}
        process={controller.process}
      />
      <TerminalPanelBody
        hostRef={controller.hostRef}
        idleHint={controller.idleHint}
        errorMessage={controller.errorMessage}
        installMessage={controller.installMessage}
        isConfigStale={props.isConfigStale}
      />
    </section>
  )
}
