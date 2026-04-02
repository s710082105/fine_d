import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { defineComponent, ref, type PropType } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TerminalSessionPanel from '../components/TerminalSessionPanel.vue'
import type { CodexTerminalSessionResponse } from '../lib/types'

type TerminalSessionPanelExposed = {
  appendOutput: (chunk: string) => void
  reset: () => void
  focusTerminal: () => void
}

const viewportHarness = vi.hoisted(() => ({
  appendOutput: vi.fn(),
  clear: vi.fn(),
  focus: vi.fn(),
  lastOnInput: null as ((payload: string) => void) | null
}))

vi.mock('../components/terminal/TerminalViewport.vue', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      name: 'TerminalViewport',
      props: {
        onInput: {
          required: true,
          type: Function as PropType<(payload: string) => void>
        }
      },
      setup(props, { expose }) {
        viewportHarness.lastOnInput = props.onInput
        expose({
          appendOutput: viewportHarness.appendOutput,
          clear: viewportHarness.clear,
          focus: viewportHarness.focus
        })

        return () => h('button', {
          'data-testid': 'terminal-viewport',
          type: 'button',
          onClick: () => props.onInput('pwd\r')
        })
      }
    })
  }
})

vi.mock('../components/terminal/TerminalComposer.vue', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      name: 'TerminalComposer',
      emits: ['submit'],
      props: {
        disabled: {
          required: true,
          type: Boolean
        }
      },
      setup(_props, { emit }) {
        return () => h('button', {
          'data-testid': 'terminal-composer',
          type: 'button',
          onClick: () => emit('submit', 'help\r')
        })
      }
    })
  }
})

function createSession(sessionId: string): CodexTerminalSessionResponse {
  return {
    session_id: sessionId,
    status: 'running',
    working_directory: '/tmp/project-alpha'
  }
}

afterEach(() => {
  viewportHarness.appendOutput.mockClear()
  viewportHarness.clear.mockClear()
  viewportHarness.focus.mockClear()
  viewportHarness.lastOnInput = null
})

describe('TerminalSessionPanel', () => {
  it('wires viewport append/reset/focus through the exposed panel handle', async () => {
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

    panelRef.value?.appendOutput('hello')
    panelRef.value?.reset()
    panelRef.value?.focusTerminal()

    expect(viewportHarness.appendOutput).toHaveBeenCalledWith('hello')
    expect(viewportHarness.clear).toHaveBeenCalledTimes(1)
    expect(viewportHarness.focus).toHaveBeenCalledTimes(1)
  })

  it('forwards viewport and composer input through submitInput', async () => {
    const view = render(TerminalSessionPanel, {
      props: {
        session: createSession('terminal-session-1'),
        errorMessage: ''
      }
    })

    await fireEvent.click(screen.getByTestId('terminal-viewport'))
    await fireEvent.click(screen.getByTestId('terminal-composer'))

    expect(view.emitted('submitInput')).toEqual([['pwd\r'], ['help\r']])
  })
})
