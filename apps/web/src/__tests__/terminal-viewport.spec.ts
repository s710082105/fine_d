import '@testing-library/jest-dom/vitest'
import { render, waitFor } from '@testing-library/vue'
import { defineComponent, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TerminalViewport from '../components/terminal/TerminalViewport.vue'
import type { TerminalAdapter } from '../components/terminal/xterm-adapter'

type TerminalViewportHandle = {
  appendOutput: (chunk: string) => Promise<void>
  clear: () => void
  focus: () => void
}

const adapterHarness = vi.hoisted(() => {
  const writes: string[] = []
  const clear = vi.fn()
  const focus = vi.fn()
  const fit = vi.fn()
  const destroy = vi.fn()
  const bindings: Array<{ onInput: (payload: string) => void }> = []

  const factory = vi.fn(
    (_host: HTMLElement, nextBindings: { onInput: (payload: string) => void }) => {
      bindings.push(nextBindings)
      const adapter: TerminalAdapter = {
        write: (content) => {
          writes.push(content)
          return Promise.resolve()
        },
        clear,
        destroy,
        focus,
        fit
      }
      return adapter
    }
  )

  return {
    bindings,
    clear,
    destroy,
    factory,
    fit,
    focus,
    writes
  }
})

vi.mock('../components/terminal/xterm-adapter', () => ({
  createTerminalAdapter: adapterHarness.factory
}))

afterEach(() => {
  adapterHarness.bindings.length = 0
  adapterHarness.clear.mockClear()
  adapterHarness.destroy.mockClear()
  adapterHarness.factory.mockClear()
  adapterHarness.fit.mockClear()
  adapterHarness.focus.mockClear()
  adapterHarness.writes.length = 0
})

describe('TerminalViewport', () => {
  it('mounts xterm and forwards keyboard input', () => {
    const onInput = vi.fn()

    render(TerminalViewport, {
      props: { onInput }
    })

    expect(adapterHarness.factory).toHaveBeenCalledTimes(1)
    adapterHarness.bindings[0]?.onInput('pwd\r')
    expect(onInput).toHaveBeenCalledWith('pwd\r')
  })

  it('exposes append, clear, and focus methods', () => {
    const viewportRef = ref<TerminalViewportHandle | null>(null)
    const Harness = defineComponent({
      components: { TerminalViewport },
      setup() {
        return { viewportRef }
      },
      template: `
        <TerminalViewport
          ref="viewportRef"
          :on-input="() => undefined"
        />
      `
    })

    render(Harness)

    return waitFor(() => {
      void viewportRef.value?.appendOutput('hello')
      viewportRef.value?.clear()
      viewportRef.value?.focus()

      expect(adapterHarness.writes).toEqual(['hello'])
      expect(adapterHarness.clear).toHaveBeenCalledTimes(1)
      expect(adapterHarness.focus).toHaveBeenCalledTimes(1)
      expect(adapterHarness.fit).toHaveBeenCalledTimes(1)
    })
  })
})
