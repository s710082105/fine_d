import '@testing-library/jest-dom/vitest'
import { render, waitFor } from '@testing-library/vue'
import { defineComponent, ref, type PropType } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TerminalSessionPanel from '../components/TerminalSessionPanel.vue'
import type { CodexTerminalSessionResponse } from '../lib/types'
import type { TerminalAdapter } from '../components/terminal/xterm-adapter'

type TerminalSessionPanelExposed = {
  appendOutput: (chunk: string) => void
  reset: () => void
  focusTerminal: () => void
}

const adapterHarness = vi.hoisted(() => {
  const writes: string[] = []
  const clear = vi.fn()
  const focus = vi.fn()

  const adapter: TerminalAdapter = {
    write: (content) => {
      writes.push(content)
    },
    clear,
    destroy: vi.fn(),
    focus,
    fit: () => undefined
  }

  return {
    clear,
    factory: vi.fn(() => adapter),
    focus,
    writes
  }
})

vi.mock('../components/terminal/xterm-adapter', () => ({
  createTerminalAdapter: adapterHarness.factory
}))

function createSession(sessionId: string): CodexTerminalSessionResponse {
  return {
    session_id: sessionId,
    status: 'running',
    working_directory: '/tmp/project-alpha'
  }
}

afterEach(() => {
  adapterHarness.clear.mockClear()
  adapterHarness.factory.mockClear()
  adapterHarness.focus.mockClear()
  adapterHarness.writes.length = 0
})

describe('TerminalSessionPanel', () => {
  it('clears the terminal when reset is called directly', async () => {
    const panelRef = ref<TerminalSessionPanelExposed | null>(null)
    const Harness = defineComponent({
      components: { TerminalSessionPanel },
      props: {
        errorMessage: {
          required: true,
          type: String
        },
        session: {
          required: true,
          type: Object as PropType<CodexTerminalSessionResponse>
        }
      },
      setup() {
        return { panelRef }
      },
      template: `
        <TerminalSessionPanel
          ref="panelRef"
          :session="session"
          :error-message="errorMessage"
        />
      `
    })

    render(Harness, {
      props: {
        session: createSession('terminal-session-1'),
        errorMessage: ''
      }
    })

    await waitFor(() => {
      expect(panelRef.value).not.toBeNull()
    })

    panelRef.value?.reset()

    expect(adapterHarness.clear).toHaveBeenCalledTimes(1)
  })

  it('appends output chunks in order and resets on session switch', async () => {
    const panelRef = ref<TerminalSessionPanelExposed | null>(null)
    const session = createSession('terminal-session-1')
    const otherSession = createSession('terminal-session-2')
    const Harness = defineComponent({
      components: { TerminalSessionPanel },
      props: {
        errorMessage: {
          required: true,
          type: String
        },
        session: {
          required: true,
          type: Object as PropType<CodexTerminalSessionResponse>
        }
      },
      setup() {
        return { panelRef }
      },
      template: `
        <TerminalSessionPanel
          ref="panelRef"
          :session="session"
          :error-message="errorMessage"
        />
      `
    })

    const view = render(Harness, {
      props: {
        session,
        errorMessage: ''
      }
    })

    await waitFor(() => {
      expect(adapterHarness.factory).toHaveBeenCalledTimes(1)
      expect(panelRef.value).not.toBeNull()
    })

    panelRef.value?.appendOutput('hello')
    panelRef.value?.appendOutput(' world')
    expect(adapterHarness.writes).toEqual(['hello', ' world'])

    await view.rerender({ session: otherSession, errorMessage: '' })

    expect(adapterHarness.clear).toHaveBeenCalledTimes(1)
    expect(adapterHarness.focus).toHaveBeenCalledTimes(1)
  })
})
