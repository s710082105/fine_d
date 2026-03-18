import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { createDefaultProjectConfig } from '../components/config/project-config-form'
import {
  ChatPanel,
  ChatPanelServices
} from '../components/session/chat-panel'
import type { SessionStreamEvent } from '../lib/types/session'

it('starts a session and renders streamed events', async () => {
  const startSession = vi.fn(async () => ({
    sessionId: 'session-1',
    sessionDir: '/tmp/session-1',
    process: {
      sessionId: 'session-1',
      pid: 42,
      command: 'codex',
      args: ['chat'],
      workingDir: '/tmp/demo',
      startedAt: '1710806400'
    }
  }))
  let listener: ((event: SessionStreamEvent) => void) | undefined
  const services: ChatPanelServices = {
    startSession,
    subscribe: (callback) => {
      listener = callback
      return () => undefined
    },
    refreshContext: async () => undefined,
    interruptSession: async () => undefined
  }
  const config = createDefaultProjectConfig()
  config.workspace.name = 'demo'
  config.workspace.root_dir = '/tmp/demo'

  render(
    <ChatPanel
      projectId="default"
      projectName="demo"
      config={config}
      configVersion="v1"
      enabledSkills={['finereport-template', 'browser-validate']}
      isConfigStale={false}
      services={services}
    />
  )

  fireEvent.change(screen.getByLabelText('Message Composer'), {
    target: { value: '生成本周报表' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => expect(startSession).toHaveBeenCalledTimes(1))
  expect(screen.getByText('生成本周报表')).toBeInTheDocument()

  await act(async () => {
    listener?.({
      sessionId: 'session-1',
      eventType: 'status',
      message: 'session started',
      timestamp: '1710806401'
    })
  })

  expect(screen.getByText('状态：running')).toBeInTheDocument()
  expect(screen.getByText('session started')).toBeInTheDocument()
  expect(screen.getByText('finereport-template')).toBeInTheDocument()
  expect(screen.getByText('browser-validate')).toBeInTheDocument()
})

it('renders tool and sync events as separate timeline items', async () => {
  let listener: ((event: SessionStreamEvent) => void) | undefined
  const services: ChatPanelServices = {
    startSession: async () => ({
      sessionId: 'session-2',
      sessionDir: '/tmp/session-2',
      process: {
        sessionId: 'session-2',
        pid: 43,
        command: 'codex',
        args: ['chat'],
        workingDir: '/tmp/demo',
        startedAt: '1710806400'
      }
    }),
    subscribe: (callback) => {
      listener = callback
      return () => undefined
    },
    refreshContext: async () => undefined,
    interruptSession: async () => undefined
  }
  const config = createDefaultProjectConfig()
  config.workspace.name = 'demo'
  config.workspace.root_dir = '/tmp/demo'

  render(
    <ChatPanel
      projectId="default"
      projectName="demo"
      config={config}
      configVersion="v2"
      enabledSkills={['sync-publish']}
      isConfigStale={false}
      services={services}
    />
  )

  fireEvent.change(screen.getByLabelText('Message Composer'), {
    target: { value: '发布模板' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await act(async () => {
    listener?.({
      sessionId: 'session-2',
      eventType: 'tool',
      message: 'write_file completed',
      timestamp: '1710806402',
      toolName: 'write_file',
      toolStatus: 'completed',
      toolSummary: '写入 report.cpt'
    })
    listener?.({
      sessionId: 'session-2',
      eventType: 'sync',
      message: 'sync completed',
      timestamp: '1710806403',
      syncAction: 'update',
      syncProtocol: 'sftp',
      syncStatus: 'completed',
      syncPath: '/srv/tomcat/webapps/webroot/WEB-INF/reportlets/report.cpt'
    })
  })

  expect(screen.getByText('Tool · write_file')).toBeInTheDocument()
  expect(screen.getAllByText('写入 report.cpt')).toHaveLength(2)
  expect(screen.getByText('Sync · update · sftp')).toBeInTheDocument()
  expect(
    screen.getAllByText('/srv/tomcat/webapps/webroot/WEB-INF/reportlets/report.cpt')
  ).toHaveLength(2)
  expect(screen.getByText('写入文件')).toBeInTheDocument()
})

it('refreshes context and interrupts the active session explicitly', async () => {
  const refreshContext = vi.fn(async () => undefined)
  const interruptSession = vi.fn(async () => undefined)
  const services: ChatPanelServices = {
    startSession: async () => ({
      sessionId: 'session-3',
      sessionDir: '/tmp/session-3',
      process: {
        sessionId: 'session-3',
        pid: 44,
        command: 'codex',
        args: [],
        workingDir: '/tmp/demo',
        startedAt: '1710806400'
      }
    }),
    subscribe: () => () => undefined,
    refreshContext,
    interruptSession
  }
  const config = createDefaultProjectConfig()
  config.workspace.name = 'demo'
  config.workspace.root_dir = '/tmp/demo'
  config.sync.host = 'files.example.com'
  config.sync.username = 'deploy'
  config.sync.local_source_dir = '/tmp/demo/reportlets'
  config.sync.remote_runtime_dir = '/srv/runtime'

  render(
    <ChatPanel
      projectId="default"
      projectName="demo"
      config={config}
      configVersion="v3-draft"
      enabledSkills={['sync-publish']}
      isConfigStale={true}
      services={services}
    />
  )

  fireEvent.change(screen.getByLabelText('Message Composer'), {
    target: { value: '继续执行同步' }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => expect(screen.getByText('状态：running')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Refresh Context' }))
  fireEvent.click(screen.getByRole('button', { name: 'Interrupt Session' }))

  expect(refreshContext).toHaveBeenCalledWith({
    project_id: 'default',
    session_id: 'session-3',
    config_version: 'v3-draft',
    enabled_skills: ['sync-publish'],
    config
  })
  expect(interruptSession).toHaveBeenCalledWith('session-3')
})
