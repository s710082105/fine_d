import { useEffect, useRef, useState } from 'react'
import type { ProjectConfig } from '../../lib/types/project-config'
import type { SessionActivityItem, TimelineItem } from '../../lib/types/session'
import {
  ActivityRail,
  Composer,
  MessageTimeline,
  SessionHeader
} from './chat-panel-sections'
import {
  buildActivities,
  buildMeta,
  buildRefreshRequest,
  buildStartRequest,
  createUserItem,
  applyStreamEvent,
  resolveStatus,
  updateActivities,
  validateDraft,
  getErrorMessage,
  nowTimestamp
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
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [activities, setActivities] = useState<SessionActivityItem[]>(buildActivities)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const sessionIdRef = useRef('')
  const startInFlightRef = useRef(false)

  useEffect(() => {
    setMeta((current) => ({ ...current, projectId, configVersion }))
  }, [configVersion, projectId])

  useEffect(() => {
    let disposed = false
    let unsubscribe: () => void = () => undefined
    const subscription = services.subscribe((event) => {
      if (sessionIdRef.current && event.sessionId !== sessionIdRef.current) return
      if (!sessionIdRef.current && !startInFlightRef.current) return
      setTimeline((current) => applyStreamEvent(current, event))
      setActivities((current) => updateActivities(current, event))
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

  const pushError = (message: string) => {
    setTimeline((current) => [
      ...current,
      { id: `error-${Date.now()}`, type: 'error', message, timestamp: nowTimestamp() }
    ])
    setMeta((current) => ({ ...current, status: 'error' }))
  }

  const handleSend = () => {
    const validationError = validateDraft(config, draft)
    if (validationError) {
      pushError(validationError)
      return
    }
    startInFlightRef.current = true
    setBusy(true)
    setTimeline((current) => [...current, createUserItem(draft)])
    void services
      .startSession(buildStartRequest(projectId, configVersion, enabledSkills, config, draft))
      .then((response) => {
        sessionIdRef.current = response.sessionId
        setMeta(buildMeta(projectId, configVersion, response.sessionId, 'running'))
        setActivities((current) =>
          current.map((item) =>
            item.id === 'launch'
              ? { ...item, status: 'active', detail: `PID ${response.process.pid}` }
              : item
          )
        )
        setDraft('')
      })
      .catch((error) => pushError(getErrorMessage(error)))
      .finally(() => {
        startInFlightRef.current = false
        setBusy(false)
      })
  }

  const handleNewSession = () => {
    sessionIdRef.current = ''
    setMeta(buildMeta(projectId, configVersion))
    setTimeline([])
    setActivities(buildActivities())
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
      <SessionHeader meta={meta} projectName={projectName} enabledSkills={enabledSkills} />
      <MessageTimeline items={timeline} />
      <ActivityRail items={activities} />
      <Composer
        draft={draft}
        busy={busy}
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
