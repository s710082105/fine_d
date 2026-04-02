import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTerminalAdapter } from '../components/terminal/xterm-adapter'

type CsiHandler = (params: readonly (number | number[])[]) => boolean | Promise<boolean>

const harness = vi.hoisted(() => {
  const handlers = new Map<string, CsiHandler>()
  const terminal = {
    buffer: {
      active: {
        cursorX: 0,
        cursorY: 0
      }
    },
    clear: vi.fn(),
    dispose: vi.fn(),
    focus: vi.fn(),
    loadAddon: vi.fn(),
    onData: vi.fn(),
    open: vi.fn(),
    parser: {
      registerCsiHandler: vi.fn((identifier: { prefix?: string; final: string }, handler: CsiHandler) => {
        const key = `${identifier.prefix ?? ''}|${identifier.final}`
        handlers.set(key, handler)
        return {
          dispose: vi.fn(() => {
            handlers.delete(key)
          })
        }
      })
    },
    refresh: vi.fn(),
    rows: 24,
    write: vi.fn()
  }

  return {
    handlers,
    terminal
  }
})

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn()
  }
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    buffer = harness.terminal.buffer
    clear = harness.terminal.clear
    dispose = harness.terminal.dispose
    focus = harness.terminal.focus
    loadAddon = harness.terminal.loadAddon
    onData = harness.terminal.onData
    open = harness.terminal.open
    parser = harness.terminal.parser
    refresh = harness.terminal.refresh
    rows = harness.terminal.rows
    write = harness.terminal.write
  }
}))

describe('createTerminalAdapter', () => {
  const resizeObserverDisconnect = vi.fn()
  const resizeObserverObserve = vi.fn()

  beforeEach(() => {
    class ResizeObserverMock {
      disconnect = resizeObserverDisconnect
      observe = resizeObserverObserve
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterEach(() => {
    harness.handlers.clear()
    harness.terminal.buffer.active.cursorX = 0
    harness.terminal.buffer.active.cursorY = 0
    harness.terminal.clear.mockClear()
    harness.terminal.dispose.mockClear()
    harness.terminal.focus.mockClear()
    harness.terminal.loadAddon.mockClear()
    harness.terminal.onData.mockClear()
    harness.terminal.open.mockClear()
    harness.terminal.parser.registerCsiHandler.mockClear()
    harness.terminal.refresh.mockClear()
    harness.terminal.write.mockClear()
    resizeObserverDisconnect.mockClear()
    resizeObserverObserve.mockClear()
    vi.unstubAllGlobals()
  })

  it('responds to cursor and device attribute queries through terminal input', async () => {
    const onInput = vi.fn()

    createTerminalAdapter(document.createElement('div'), { onInput })

    harness.terminal.buffer.active.cursorX = 4
    harness.terminal.buffer.active.cursorY = 2

    const deviceStatusHandler = harness.handlers.get('|n')
    const primaryDeviceAttributesHandler = harness.handlers.get('|c')

    await deviceStatusHandler?.([6])
    await primaryDeviceAttributesHandler?.([])

    expect(onInput).toHaveBeenNthCalledWith(1, '\u001b[3;5R')
    expect(onInput).toHaveBeenNthCalledWith(2, '\u001b[?1;2c')
  })

  it('resolves writes after xterm finishes consuming the chunk', async () => {
    harness.terminal.write.mockImplementation(
      (_content: string, callback?: () => void) => {
        callback?.()
      }
    )
    const adapter = createTerminalAdapter(document.createElement('div'), {
      onInput: vi.fn()
    })

    await expect(adapter.write('hello')).resolves.toBeUndefined()
    expect(harness.terminal.write).toHaveBeenCalledWith('hello', expect.any(Function))
  })
})
