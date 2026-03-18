import type {
  SessionActivityItem,
  SessionMeta,
  TimelineItem
} from '../../lib/types/session'

interface SessionHeaderProps {
  meta: SessionMeta
  projectName: string
  enabledSkills: string[]
}

export function SessionHeader({
  meta,
  projectName,
  enabledSkills
}: SessionHeaderProps) {
  return (
    <section className="session-card">
      <div className="section-heading">Session Header</div>
      <div className="session-header-grid">
        <span>项目：{projectName || 'default'}</span>
        <span>会话：{meta.sessionId || '未开始'}</span>
        <span>配置版本：{meta.configVersion}</span>
        <span>状态：{meta.status}</span>
      </div>
      <div className="session-skill-row">
        {enabledSkills.map((skill) => (
          <span key={skill}>{skill}</span>
        ))}
      </div>
    </section>
  )
}

export function MessageTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <section className="session-card timeline-card">
      <div className="section-heading">Message Timeline</div>
      {items.length === 0 && <p className="timeline-empty">等待首条消息创建会话</p>}
      {items.map((item) => (
        <article key={item.id} className={`timeline-item timeline-${item.type}`}>
          {renderTimelineContent(item)}
        </article>
      ))}
    </section>
  )
}

function renderTimelineContent(item: TimelineItem) {
  if ('content' in item) {
    return <p>{item.content}</p>
  }
  if (item.type === 'tool') {
    return (
      <>
        <p>{`Tool · ${item.name}`}</p>
        {item.summary && <p>{item.summary}</p>}
      </>
    )
  }
  if (item.type === 'sync') {
    return (
      <>
        <p>{`Sync · ${item.action} · ${item.protocol}`}</p>
        <p>{item.path}</p>
      </>
    )
  }
  return <p>{item.message}</p>
}

export function ActivityRail({ items }: { items: SessionActivityItem[] }) {
  return (
    <section className="session-card">
      <div className="section-heading">Activity Rail</div>
      <div className="activity-rail">
        {items.map((item) => (
          <article key={item.id} className={`activity-item activity-${item.status}`}>
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

interface ComposerProps {
  draft: string
  busy: boolean
  onDraftChange: (value: string) => void
  onSend: () => void
  onNewSession: () => void
  onRefreshContext: () => void
  onInterruptSession: () => void
}

export function Composer({
  draft,
  busy,
  onDraftChange,
  onSend,
  onNewSession,
  onRefreshContext,
  onInterruptSession
}: ComposerProps) {
  return (
    <section className="session-card composer-card">
      <div className="section-heading">Composer</div>
      <label>
        Message Composer
        <textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} rows={5} />
      </label>
      <div className="composer-actions">
        <button type="button" disabled={busy} onClick={onSend}>
          Send
        </button>
        <button type="button" onClick={onNewSession}>
          New Session
        </button>
        <button type="button" onClick={onRefreshContext}>
          Refresh Context
        </button>
        <button type="button" onClick={onInterruptSession}>
          Interrupt Session
        </button>
      </div>
    </section>
  )
}
