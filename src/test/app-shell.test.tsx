import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { AppShell } from '../App'
import { createDefaultProjectConfig } from '../components/config/project-config-form'
import type { ChatPanelServices } from '../components/session/chat-panel'

function createChatPanelServices(): ChatPanelServices {
  return {
    startSession: async () => {
      throw new Error('startSession should not be called in this test')
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
          loadConfig: async () => createDefaultProjectConfig(),
          saveConfig: async () => undefined
        }}
        chatPanelServices={createChatPanelServices()}
      />
    )
  })
  expect(screen.getByText('Project Config')).toBeInTheDocument()
  expect(screen.getByText('Session Header')).toBeInTheDocument()
  expect(screen.getByText('Message Timeline')).toBeInTheDocument()
  expect(screen.getByText('Activity Rail')).toBeInTheDocument()
  expect(screen.getByText('Composer')).toBeInTheDocument()
})

it('marks the current session stale when config changes', async () => {
  await act(async () => {
    render(
      <AppShell
        projectConfigServices={{
          loadConfig: async () => createDefaultProjectConfig(),
          saveConfig: async () => undefined
        }}
        chatPanelServices={createChatPanelServices()}
      />
    )
  })

  fireEvent.change(screen.getByLabelText('Workspace Name'), {
    target: { value: 'qa-demo' }
  })

  expect(screen.getByText('需要新建会话或手动刷新上下文')).toBeInTheDocument()
})
