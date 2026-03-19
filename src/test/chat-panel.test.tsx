import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Mock } from 'vitest'
import { vi } from 'vitest'
import { createDefaultProjectConfig } from '../components/config/project-config-form'
import { ChatPanel, type ChatPanelServices } from '../components/session/chat-panel'
import type { SessionStreamEvent, StartSessionResponse } from '../lib/types/session'

function buildStartResponse(sessionId: string, pid: number): StartSessionResponse {
  return {
    sessionId,
    sessionDir: `/tmp/${sessionId}`,
    process: {
      sessionId,
      pid,
      command: 'codex',
      args: ['chat'],
      workingDir: '/tmp/demo',
      startedAt: '1710806400'
    }
  }
}

function createServices(
  overrides: Partial<ChatPanelServices> = {}
): ChatPanelServices & { emit: (event: SessionStreamEvent) => Promise<void> } {
  let listener: ((event: SessionStreamEvent) => void) | undefined
  return {
    checkCodexInstallation: async () => true,
    startSession: async () => buildStartResponse('session-1', 42),
    sendSessionMessage: async () => buildResumeResponse('session-1', 43),
    subscribe: (callback) => {
      listener = callback
      return () => undefined
    },
    refreshContext: async () => undefined,
    interruptSession: async () => undefined,
    emit: async (event) => {
      await act(async () => listener?.(event))
    },
    ...overrides
  }
}

function renderChatPanel(services: ChatPanelServices, isConfigStale = false) {
  const config = createDefaultProjectConfig()
  config.workspace.name = 'demo'
  config.workspace.root_dir = '/tmp/demo'
  config.sync.host = 'files.example.com'
  config.sync.username = 'deploy'
  config.sync.remote_runtime_dir = '/srv/runtime'

  render(
    <ChatPanel
      projectId="default"
      projectName="demo"
      config={config}
      configVersion="v1"
      enabledSkills={['fr-cpt', 'chrome-cdp']}
      isConfigStale={isConfigStale}
      services={services}
    />
  )

  return { config }
}

function getStreamCard() {
  return screen.getByText('Codex 输出').closest('section')
}

async function waitForComposerReady() {
  await waitFor(() => expect(screen.getByRole('button', { name: '发送' })).toBeEnabled())
}

function buildResumeResponse(sessionId: string, pid: number) {
  return {
    sessionId,
    process: {
      sessionId,
      pid,
      command: 'codex',
      args: ['exec', 'resume'],
      workingDir: '/tmp/demo',
      startedAt: '1710806402'
    }
  }
}

it('starts a session and renders raw streamed output', async () => {
  const startSession = vi.fn(async () => buildStartResponse('session-1', 42))
  const services = createServices({ startSession })
  renderChatPanel(services)

  await waitForComposerReady()
  fireEvent.change(screen.getByLabelText('会话输入'), {
    target: { value: '生成本周报表' }
  })
  fireEvent.click(screen.getByRole('button', { name: '发送' }))

  await waitFor(() => expect(startSession).toHaveBeenCalledTimes(1))
  await services.emit({
    sessionId: 'session-1',
    eventType: 'status',
    message: 'session started',
    timestamp: '1710806401'
  })
  await services.emit({
    sessionId: 'session-1',
    eventType: 'stdout',
    message: '正在生成周报...',
    timestamp: '1710806402'
  })

  expect(screen.getByText('状态：运行中')).toBeInTheDocument()
  expect(getStreamCard()).toHaveTextContent('[launch] PID 42')
  expect(getStreamCard()).toHaveTextContent('[status] session started')
  expect(getStreamCard()).toHaveTextContent('正在生成周报...')
})

it('renders tool and sync events as raw output lines', async () => {
  const services = createServices({
    startSession: async () => buildStartResponse('session-2', 43)
  })
  renderChatPanel(services)

  await waitForComposerReady()
  fireEvent.change(screen.getByLabelText('会话输入'), {
    target: { value: '发布模板' }
  })
  fireEvent.click(screen.getByRole('button', { name: '发送' }))

  await waitFor(() => expect(screen.getByText('会话：session-2')).toBeInTheDocument())
  await services.emit({
    sessionId: 'session-2',
    eventType: 'tool',
    message: 'write_file completed',
    timestamp: '1710806402',
    toolName: 'write_file',
    toolStatus: 'completed',
    toolSummary: '写入 report.cpt'
  })
  await services.emit({
    sessionId: 'session-2',
    eventType: 'sync',
    message: 'sync completed',
    timestamp: '1710806403',
    syncAction: 'update',
    syncProtocol: 'sftp',
    syncStatus: 'completed',
    syncPath: '/srv/tomcat/webapps/webroot/WEB-INF/reportlets/report.cpt'
  })

  expect(getStreamCard()).toHaveTextContent('[tool:write_file] 写入 report.cpt')
  expect(getStreamCard()).toHaveTextContent(
    '[sync:update:sftp] /srv/tomcat/webapps/webroot/WEB-INF/reportlets/report.cpt'
  )
})

it('shows install guidance and disables actions when codex is unavailable', async () => {
  const services = createServices({
    checkCodexInstallation: async () => false
  })
  renderChatPanel(services)

  await waitFor(() =>
    expect(screen.getByText('请使用 npm i -g @openai/codex 安装')).toBeInTheDocument()
  )
  expect(screen.getByRole('button', { name: '发送' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '新建会话' })).toBeDisabled()
  expect(getStreamCard()).toHaveTextContent('等待 Codex 安装完成')
})

it('refreshes context and interrupts the active session explicitly', async () => {
  const refreshContext = vi.fn(async () => undefined)
  const interruptSession = vi.fn(async () => undefined)
  const services = createServices({
    startSession: async () => buildStartResponse('session-3', 44),
    refreshContext,
    interruptSession
  })
  const { config } = renderChatPanel(services, true)

  await waitForComposerReady()
  fireEvent.change(screen.getByLabelText('会话输入'), {
    target: { value: '继续执行同步' }
  })
  fireEvent.click(screen.getByRole('button', { name: '发送' }))

  await waitFor(() => expect(screen.getByText('会话：session-3')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: '刷新上下文' }))
  fireEvent.click(screen.getByRole('button', { name: '中断会话' }))

  expect(screen.getByText('需要新建会话或手动刷新上下文')).toBeInTheDocument()
  expect(refreshContext).toHaveBeenCalledWith({
    project_id: 'default',
    session_id: 'session-3',
    config_version: 'v1',
    enabled_skills: ['fr-cpt', 'chrome-cdp'],
    config
  })
  expect(interruptSession).toHaveBeenCalledWith('session-3')
})

it('reuses the existing codex session for follow-up messages', async () => {
  const startSession = vi.fn(async () => buildStartResponse('session-4', 45))
  const sendSessionMessage = vi.fn(async () => buildResumeResponse('session-4', 46))
  const services = Object.assign(createServices({ startSession }), {
    sendSessionMessage
  }) as ChatPanelServices & {
    emit: (event: SessionStreamEvent) => Promise<void>
    sendSessionMessage: Mock
  }
  renderChatPanel(services)

  await waitForComposerReady()
  fireEvent.change(screen.getByLabelText('会话输入'), {
    target: { value: '先创建会话' }
  })
  fireEvent.click(screen.getByRole('button', { name: '发送' }))

  await waitFor(() => expect(startSession).toHaveBeenCalledTimes(1))
  await services.emit({
    sessionId: 'session-4',
    eventType: 'stdout',
    message: 'OpenAI Codex v0.115.0 (research preview)',
    timestamp: '1710806401'
  })
  await services.emit({
    sessionId: 'session-4',
    eventType: 'stdout',
    message: 'session id: codex-session-1',
    timestamp: '1710806402'
  })
  await services.emit({
    sessionId: 'session-4',
    eventType: 'process_exit',
    message: 'codex process exited: exit status: 0',
    timestamp: '1710806403'
  })

  fireEvent.change(screen.getByLabelText('会话输入'), {
    target: { value: '继续补充上下文' }
  })
  fireEvent.click(screen.getByRole('button', { name: '发送' }))

  await waitFor(() => expect(sendSessionMessage).toHaveBeenCalledTimes(1))
  expect(startSession).toHaveBeenCalledTimes(1)
  expect(sendSessionMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      project_id: 'default',
      session_id: 'session-4',
      config_version: 'v1',
      message: '继续补充上下文',
      codex_session_id: 'codex-session-1',
      codex: {
        command: 'codex',
        args: [],
        working_dir: '/tmp/demo'
      }
    })
  )
})
