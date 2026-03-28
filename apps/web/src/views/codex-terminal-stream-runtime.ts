import { createCodexTerminalStreamController } from '../components/terminal/codex-terminal-stream-controller'
import {
  buildCodexTerminalEventStreamUrl,
  streamCodexTerminalSession
} from '../lib/api'

export function createCodexTerminalWorkbenchStreamController() {
  return createCodexTerminalStreamController({
    buildEventStreamUrl: buildCodexTerminalEventStreamUrl,
    createEventSource: (url) => new EventSource(url),
    readStreamChunk: streamCodexTerminalSession,
    schedulePoll: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearScheduledPoll: (timerId) => window.clearTimeout(timerId)
  })
}
