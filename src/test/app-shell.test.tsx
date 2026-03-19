import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AppShell } from '../App'
import { createDefaultProjectConfig } from '../components/config/project-config-form'
import type { ChatPanelServices } from '../components/session/chat-panel'

function createChatPanelServices(): ChatPanelServices {
  return {
    checkCodexInstallation: async () => true,
    startSession: async () => {
      throw new Error('startSession should not be called in this test')
    },
    sendSessionMessage: async () => {
      throw new Error('sendSessionMessage should not be called in this test')
    },
    subscribe: () => () => undefined,
    refreshContext: async () => undefined,
    interruptSession: async () => undefined
  }
}

it('renders config and chat regions', async () => {
  await act(async () => {
    render(
      <AppShell
        projectConfigServices={{
          browseDirectory: async () => '/tmp/demo',
          loadConfig: async () => ({
            exists: false,
            config: createDefaultProjectConfig()
          }),
          listReportletEntries: async () => [],
          saveConfig: async () => undefined
        }}
        chatPanelServices={createChatPanelServices()}
      />
    )
  })
  expect(screen.getByText('项目配置')).toBeInTheDocument()
  expect(screen.getByLabelText('项目目录')).toBeInTheDocument()
  expect(screen.getByText('会话信息')).toBeInTheDocument()
  expect(screen.getByText('Codex 输出')).toBeInTheDocument()
  expect(screen.getByText('输入区')).toBeInTheDocument()
})

it('marks the current session stale when config changes', async () => {
  await act(async () => {
    render(
      <AppShell
        projectConfigServices={{
          browseDirectory: async () => '/tmp/demo',
          loadConfig: async () => ({
            exists: false,
            config: createDefaultProjectConfig()
          }),
          listReportletEntries: async () => [],
          saveConfig: async () => undefined
        }}
        chatPanelServices={createChatPanelServices()}
      />
    )
  })

  fireEvent.click(screen.getByRole('button', { name: '选择项目目录' }))

  await waitFor(() => expect(screen.getByLabelText('项目名称')).toBeInTheDocument())

  fireEvent.change(screen.getByLabelText('项目名称'), {
    target: { value: 'qa-demo' }
  })

  expect(screen.getByText('需要新建会话或手动刷新上下文')).toBeInTheDocument()
})
