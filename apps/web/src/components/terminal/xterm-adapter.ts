import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'

export interface TerminalAdapter {
  write: (content: string) => Promise<void>
  clear: () => void
  destroy: () => void
  focus: () => void
  fit: () => void
}

export interface TerminalAdapterBindings {
  onInput: (payload: string) => void
}

export type TerminalAdapterFactory = (
  host: HTMLElement,
  bindings: TerminalAdapterBindings
) => TerminalAdapter

const TERMINAL_THEME = {
  background: '#07111f',
  foreground: '#d7e3f4',
  cursor: '#9bd1ff',
  cursorAccent: '#07111f',
  selectionBackground: 'rgba(114, 170, 255, 0.28)',
  selectionInactiveBackground: 'rgba(114, 170, 255, 0.16)',
  black: '#07111f',
  red: '#ff6b6b',
  green: '#86efac',
  yellow: '#f5d76e',
  blue: '#7dc4ff',
  magenta: '#d8b4fe',
  cyan: '#67e8f9',
  white: '#d7e3f4',
  brightBlack: '#60758d',
  brightRed: '#ff9c9c',
  brightGreen: '#bbf7d0',
  brightYellow: '#fde68a',
  brightBlue: '#bae6fd',
  brightMagenta: '#f5d0fe',
  brightCyan: '#a5f3fc',
  brightWhite: '#f8fbff'
} as const

const PRIMARY_DEVICE_ATTRIBUTES = '\u001b[?1;2c'

type CsiParams = readonly (number | readonly number[])[]

function isWindowsHost(): boolean {
  return navigator.userAgent.toLowerCase().includes('windows')
}

function firstParam(params: CsiParams): number | null {
  const value = params[0]
  return typeof value === 'number' ? value : null
}

function respondCursorPosition(
  terminal: Terminal,
  bindings: TerminalAdapterBindings
): boolean {
  const row = terminal.buffer.active.cursorY + 1
  const column = terminal.buffer.active.cursorX + 1
  bindings.onInput(`\u001b[${row};${column}R`)
  return true
}

function registerTerminalQueryHandlers(
  terminal: Terminal,
  bindings: TerminalAdapterBindings
) {
  const cursorReportDisposable = terminal.parser.registerCsiHandler(
    { final: 'n' },
    (params) => {
      if (firstParam(params) !== 6) {
        return false
      }
      return respondCursorPosition(terminal, bindings)
    }
  )
  const primaryDeviceAttributesDisposable = terminal.parser.registerCsiHandler(
    { final: 'c' },
    (params) => {
      const param = firstParam(params)
      if (params.length > 0 && param !== 0) {
        return false
      }
      bindings.onInput(PRIMARY_DEVICE_ATTRIBUTES)
      return true
    }
  )

  return {
    dispose() {
      cursorReportDisposable.dispose()
      primaryDeviceAttributesDisposable.dispose()
    }
  }
}

function fitTerminal(terminal: Terminal, fitAddon: FitAddon): void {
  fitAddon.fit()
  if (terminal.rows > 0) {
    terminal.refresh(0, terminal.rows - 1)
  }
}

export const createTerminalAdapter: TerminalAdapterFactory = (host, bindings) => {
  const terminal = new Terminal({
    allowTransparency: true,
    cursorBlink: true,
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.45,
    theme: TERMINAL_THEME,
    ...(isWindowsHost() ? { windowsPty: { backend: 'conpty' as const } } : {})
  })
  const fitAddon = new FitAddon()
  const resizeObserver = new ResizeObserver(() => fitTerminal(terminal, fitAddon))
  const queryHandlers = registerTerminalQueryHandlers(terminal, bindings)

  terminal.loadAddon(fitAddon)
  terminal.open(host)
  terminal.onData(bindings.onInput)
  resizeObserver.observe(host)

  queueMicrotask(() => {
    fitTerminal(terminal, fitAddon)
    terminal.focus()
  })

  return {
    write: (content) => new Promise((resolve) => {
      terminal.write(content, () => resolve())
    }),
    clear: () => terminal.clear(),
    destroy: () => {
      resizeObserver.disconnect()
      queryHandlers.dispose()
      terminal.dispose()
    },
    focus: () => terminal.focus(),
    fit: () => fitTerminal(terminal, fitAddon)
  }
}
