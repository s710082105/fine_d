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

export const createTerminalAdapter: TerminalAdapterFactory = (host, bindings) => {
  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.45,
    theme: {
      background: '#0f1720',
      foreground: '#d7e3f3',
      cursor: '#9bd1ff',
      selectionBackground: 'rgba(114, 170, 255, 0.28)'
    }
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
