import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'

export interface TerminalAdapter {
  write: (content: string) => void
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

function isWindowsHost(): boolean {
  return navigator.userAgent.toLowerCase().includes('windows')
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

  terminal.loadAddon(fitAddon)
  terminal.open(host)
  terminal.onData(bindings.onInput)
  resizeObserver.observe(host)

  queueMicrotask(() => {
    fitTerminal(terminal, fitAddon)
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
    fit: () => fitTerminal(terminal, fitAddon)
  }
}
