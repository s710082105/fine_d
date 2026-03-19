import type { SessionMeta } from '../../lib/types/session'
import { localizeSessionStatus } from './chat-panel-state'

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
      <div className="section-heading">会话信息</div>
      <div className="session-header-grid">
        <span>项目：{projectName || '默认项目'}</span>
        <span>会话：{meta.sessionId || '未开始'}</span>
        <span>配置版本：{meta.configVersion}</span>
        <span>状态：{localizeSessionStatus(meta.status)}</span>
      </div>
      <div className="session-skill-row">
        {enabledSkills.map((skill) => (
          <span key={skill}>{skill}</span>
        ))}
      </div>
    </section>
  )
}

export function StreamOutput({
  content,
  emptyMessage
}: {
  content: string
  emptyMessage: string
}) {
  return (
    <section className="session-card stream-card">
      <div className="section-heading">Codex 输出</div>
      {content ? (
        <pre className="stream-output">{content}</pre>
      ) : (
        <p className="timeline-empty">{emptyMessage}</p>
      )}
    </section>
  )
}

interface ComposerProps {
  draft: string
  busy: boolean
  codexReady: boolean
  onDraftChange: (value: string) => void
  onSend: () => void
  onNewSession: () => void
  onRefreshContext: () => void
  onInterruptSession: () => void
}

export function Composer({
  draft,
  busy,
  codexReady,
  onDraftChange,
  onSend,
  onNewSession,
  onRefreshContext,
  onInterruptSession
}: ComposerProps) {
  return (
    <section className="session-card composer-card">
      <div className="section-heading">输入区</div>
      <label>
        会话输入
        <textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} rows={5} />
      </label>
      <div className="composer-actions">
        <button type="button" disabled={busy || !codexReady} onClick={onSend}>
          发送
        </button>
        <button type="button" disabled={!codexReady} onClick={onNewSession}>
          新建会话
        </button>
        <button type="button" disabled={!codexReady} onClick={onRefreshContext}>
          刷新上下文
        </button>
        <button type="button" disabled={!codexReady} onClick={onInterruptSession}>
          中断会话
        </button>
      </div>
    </section>
  )
}
