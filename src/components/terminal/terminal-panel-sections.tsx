import { Alert, Button, Space } from 'antd'
import type { RefObject } from 'react'
import type { TerminalProcessMetadata } from '../../lib/types/terminal'

const STALE_NOTICE = '配置已变更，保存后请重新启动 Codex'

interface TerminalPanelHeaderProps {
  canStart: boolean
  onClose: () => void
  onRestart: () => void
  onStart: () => void
  statusLabel: string
  projectName: string
  configVersion: string
  workspaceRoot: string
  process: TerminalProcessMetadata | null
}

export function TerminalPanelHeader({
  canStart,
  onClose,
  onRestart,
  onStart,
  statusLabel,
  projectName,
  configVersion,
  workspaceRoot,
  process
}: TerminalPanelHeaderProps) {
  return (
    <header className="terminal-panel__header">
      <div className="terminal-panel__summary">
        <div className="terminal-panel__status-row">
          <p className="section-heading">终端状态</p>
          <p className="terminal-panel__status">{statusLabel}</p>
        </div>
        <p className="terminal-panel__project">
          {projectName} · {configVersion}
        </p>
        <p className="terminal-panel__workspace">{workspaceRoot}</p>
      </div>
      <div className="terminal-panel__meta">
        {process && <p className="terminal-panel__pid">PID {process.pid}</p>}
        <Space className="terminal-panel__header-actions" wrap>
          <Button type="primary" onClick={onStart} disabled={!canStart}>
            启动 Codex
          </Button>
          <Button onClick={onRestart}>
            重启终端
          </Button>
          <Button danger onClick={onClose}>
            关闭终端
          </Button>
        </Space>
      </div>
    </header>
  )
}

interface TerminalPanelBodyProps {
  hostRef: RefObject<HTMLDivElement>
  idleHint?: string
  errorMessage?: string
  installMessage?: string
  isConfigStale: boolean
}

export function TerminalPanelBody({
  hostRef,
  idleHint,
  errorMessage,
  installMessage,
  isConfigStale
}: TerminalPanelBodyProps) {
  return (
    <div className="terminal-panel__body">
      {installMessage ? (
        <Alert className="terminal-panel__alert" showIcon type="warning" message={installMessage} />
      ) : null}
      {errorMessage ? (
        <Alert className="terminal-panel__alert" showIcon type="error" message={errorMessage} />
      ) : null}
      {isConfigStale ? (
        <Alert className="terminal-panel__alert" showIcon type="success" message={STALE_NOTICE} />
      ) : null}
      <div className="terminal-panel__viewport-wrap">
        {idleHint && <p className="terminal-panel__hint">{idleHint}</p>}
        <div ref={hostRef} className="terminal-panel__viewport" data-testid="terminal-viewport" />
      </div>
    </div>
  )
}
