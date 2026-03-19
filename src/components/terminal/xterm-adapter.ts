import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'

export interface TerminalSize {
  rows: number
  columns: number
}

export interface TerminalAdapter {
  write: (content: string) => void
  clear: () => void
  destroy: () => void
  focus: () => void
  fit: () => TerminalSize
  refresh: () => TerminalSize
}

export interface TerminalAdapterBindings {
  onInput: (payload: string) => void
  onResize: (size: TerminalSize) => void
}

export type TerminalAdapterFactory = (
  host: HTMLElement,
  bindings: TerminalAdapterBindings
) => TerminalAdapter

const TERMINAL_THEME = {
  background: '#0b1420',
  foreground: '#d7e3f3',
  cursor: '#9bd1ff',
  cursorAccent: '#08111b',
  selectionBackground: 'rgba(114, 170, 255, 0.28)',
  selectionInactiveBackground: 'rgba(114, 170, 255, 0.16)',
  black: '#0b1220',
  red: '#f25f6b',
  green: '#7fd88a',
  yellow: '#f0c674',
  blue: '#69b7ff',
  magenta: '#c792ea',
  cyan: '#5ad4e6',
  white: '#d7e3f3',
  brightBlack: '#60758d',
  brightRed: '#ff8792',
  brightGreen: '#9ff3ac',
  brightYellow: '#ffd787',
  brightBlue: '#93ceff',
  brightMagenta: '#ddb1ff',
  brightCyan: '#86ecff',
  brightWhite: '#f7fbff'
} as const

function isWindowsHost() {
  return navigator.userAgent.toLowerCase().includes('windows')
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
  const resizeObserver = new ResizeObserver(() => {
    bindings.onResize(refresh())
  })

  terminal.loadAddon(fitAddon)
  terminal.open(host)
  terminal.onData((payload) => bindings.onInput(payload))
  resizeObserver.observe(host)

  function fit(): TerminalSize {
    fitAddon.fit()
    return {
      rows: terminal.rows,
      columns: terminal.cols
    }
  }

  function refresh(): TerminalSize {
    const size = fit()
    if (terminal.rows > 0) {
      terminal.refresh(0, terminal.rows - 1)
    }
    return size
  }

  queueMicrotask(() => {
    bindings.onResize(refresh())
    terminal.focus()
  })

  return {
    write: (content) => terminal.write(content),
    clear: () => terminal.clear(),
    destroy: () => {
      resizeObserver.disconnect()
      terminal.dispose()
    },
    focus: () => terminal.focus(),
    fit,
    refresh
  }
}
