import { useEffect, useRef, useState } from 'react'
import type { ProjectConfig } from '../../lib/types/project-config'
import { Composer, StreamOutput, SessionHeader } from './chat-panel-sections'
import {
  appendRawLine,
  buildMeta,
  buildRefreshRequest,
  buildSendRequest,
  buildStartRequest,
  appendRawOutput,
  extractCodexSessionId,
  resolveStatus,
  validateDraft,
  getErrorMessage
} from './chat-panel-state'
import { ChatPanelServices, resolveTauriServices } from './session-services'

interface ChatPanelProps {
  projectId: string
  projectName: string
  config: ProjectConfig
  configVersion: string
  enabledSkills: string[]
  isConfigStale: boolean
  services?: ChatPanelServices
}

export function ChatPanel({
  projectId,
  projectName,
  config,
  configVersion,
  enabledSkills,
  isConfigStale,
  services = resolveTauriServices()
}: ChatPanelProps) {
  const [meta, setMeta] = useState(() => buildMeta(projectId, configVersion))
  const [rawOutput, setRawOutput] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [codexReady, setCodexReady] = useState(false)
  const [codexChecked, setCodexChecked] = useState(false)
  const sessionIdRef = useRef('')
  const codexSessionIdRef = useRef('')
  const startInFlightRef = useRef(false)

  const pushError = (message: string) => {
    setMeta((current) => ({ ...current, status: 'error' }))
    setRawOutput((current) => appendRawLine(current, `[error] ${message}`))
  }

  useEffect(() => {
    setMeta((current) => ({ ...current, projectId, configVersion }))
  }, [configVersion, projectId])

  useEffect(() => {
    let active = true
    void services
      .checkCodexInstallation()
      .then((installed) => {
        if (!active) return
        setCodexReady(installed)
        setCodexChecked(true)
      })
      .catch((error) => {
        if (!active) return
        setCodexReady(false)
        setCodexChecked(true)
        pushError(getErrorMessage(error))
      })
    return () => {
      active = false
    }
  }, [services])

  useEffect(() => {
    let disposed = false
    let unsubscribe: () => void = () => undefined
    const subscription = services.subscribe((event) => {
      if (sessionIdRef.current && event.sessionId !== sessionIdRef.current) return
      if (!sessionIdRef.current && !startInFlightRef.current) return
      const codexSessionId = extractCodexSessionId(event)
      if (codexSessionId) {
        codexSessionIdRef.current = codexSessionId
      }
      setRawOutput((current) => appendRawOutput(current, event))
      setMeta((current) => ({ ...current, status: resolveStatus(current.status, event) }))
    })
    void Promise.resolve(subscription).then((cleanup) => {
      if (disposed) {
        cleanup()
        return
      }
      unsubscribe = cleanup
    })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [services])

  const startSession = () => {
    startInFlightRef.current = true
    setBusy(true)
    void services
      .startSession(buildStartRequest(projectId, configVersion, enabledSkills, config, draft))
      .then((response) => {
        sessionIdRef.current = response.sessionId
        setMeta(buildMeta(projectId, configVersion, response.sessionId, 'running'))
        setRawOutput((current) => appendRawLine(current, `[launch] PID ${response.process.pid}`))
        setDraft('')
      })
      .catch((error) => pushError(getErrorMessage(error)))
      .finally(() => {
        startInFlightRef.current = false
        setBusy(false)
      })
  }

  const resumeSession = (codexSessionId: string) => {
    setBusy(true)
    void services
      .sendSessionMessage(
        buildSendRequest(projectId, meta.sessionId, configVersion, config, draft, codexSessionId)
      )
      .then((response) => {
        setMeta(buildMeta(projectId, configVersion, response.sessionId, 'running'))
        setRawOutput((current) => appendRawLine(current, `[launch] PID ${response.process.pid}`))
        setDraft('')
      })
      .catch((error) => pushError(getErrorMessage(error)))
      .finally(() => {
        setBusy(false)
      })
  }

  const handleSend = () => {
    if (!codexReady) {
      pushError('请使用 npm i -g @openai/codex 安装')
      return
    }
    const validationError = validateDraft(config, draft)
    if (validationError) {
      pushError(validationError)
      return
    }
    if (!meta.sessionId) {
      startSession()
      return
    }
    if (!codexSessionIdRef.current) {
      pushError('当前 Codex 会话 ID 尚未就绪，无法继续对话')
      return
    }
    resumeSession(codexSessionIdRef.current)
  }

  const handleNewSession = () => {
    sessionIdRef.current = ''
    codexSessionIdRef.current = ''
    setMeta(buildMeta(projectId, configVersion))
    setRawOutput('')
    setDraft('')
  }

  const handleRefreshContext = () => {
    if (!meta.sessionId) {
      pushError('当前还没有可刷新的会话')
      return
    }
    void services
      .refreshContext(
        buildRefreshRequest(projectId, meta.sessionId, configVersion, enabledSkills, config)
      )
      .catch((error) => pushError(getErrorMessage(error)))
  }

  const handleInterruptSession = () => {
    if (!meta.sessionId) {
      pushError('当前还没有可中断的会话')
      return
    }
    void services.interruptSession(meta.sessionId).catch((error) => pushError(getErrorMessage(error)))
  }

  return (
    <div className="chat-panel">
      {isConfigStale && <div className="session-warning">需要新建会话或手动刷新上下文</div>}
      {codexChecked && !codexReady && (
        <div className="session-warning">请使用 npm i -g @openai/codex 安装</div>
      )}
      <SessionHeader meta={meta} projectName={projectName} enabledSkills={enabledSkills} />
      <StreamOutput
        content={rawOutput}
        emptyMessage={codexReady ? '等待首条消息创建会话' : '等待 Codex 安装完成'}
      />
      <Composer
        draft={draft}
        busy={busy || meta.status === 'running'}
        codexReady={codexReady}
        onDraftChange={setDraft}
        onSend={handleSend}
        onNewSession={handleNewSession}
        onRefreshContext={handleRefreshContext}
        onInterruptSession={handleInterruptSession}
      />
    </div>
  )
}

export type { ChatPanelServices }
