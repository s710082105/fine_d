import { onBeforeUnmount, onMounted, ref } from 'vue'

import {
  ApiError,
  closeCodexTerminalSession,
  createCodexTerminalSession,
  generateProjectContext,
  getCodexTerminalSession,
  getCurrentProject,
  getRemoteOverview,
  streamCodexTerminalSession,
  writeCodexTerminalInput
} from '../lib/api'
import { clearStoredCodexSession, loadStoredCodexSession } from '../lib/codex-session-storage'
import type {
  CodexTerminalSessionResponse,
  DatasourceConnectionResponse,
  ProjectContextResponse,
  ProjectCurrentStateResponse
} from '../lib/types'
import { createTerminalConnection } from '../components/terminal/use-terminal-connection'
import {
  createTerminalConnectionState,
  markClosed,
  markFailed,
  markStreaming,
  startBooting
} from '../components/terminal/terminal-connection-state'
import {
  MISSING_SESSION_MESSAGE,
  buildErrorMessage,
  saveSessionState,
  toProjectContextResponse
} from './codex-terminal-workbench-helpers'

export interface TerminalSessionPanelHandle {
  appendOutput(chunk: string): Promise<void>
  reset(): void
  focusTerminal(): void
}

export function useCodexTerminalWorkbench() {
  const currentProjectPath = ref('')
  const contextLoading = ref(false)
  const contextState = ref<ProjectContextResponse | null>(null)
  const connections = ref<readonly DatasourceConnectionResponse[]>([])
  const overviewLoading = ref(false)
  const overviewErrorMessage = ref('')
  const directoryPanelKey = ref(0)
  const session = ref<CodexTerminalSessionResponse | null>(null)
  const terminalPanelRef = ref<TerminalSessionPanelHandle | null>(null)
  const errorMessage = ref('')
  let connectionState = createTerminalConnectionState()

  let workbenchLifecycleId = 0

  const terminalConnection = createTerminalConnection({
    readStreamChunk: streamCodexTerminalSession,
    writeInput: async (sessionId, data) => {
      await writeCodexTerminalInput(sessionId, data)
    },
    schedulePoll: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearScheduledPoll: (timerId) => window.clearTimeout(timerId),
    onChunk: (chunk) => terminalPanelRef.value?.appendOutput(chunk),
    onStatus: (status) => {
      patchConnectionStatus(status)
    },
    onMissingSession: () => {
      handleMissingSession()
    },
    onError: (message) => {
      connectionState = markFailed(connectionState, message)
      errorMessage.value = message
    }
  })

  onMounted(() => {
    void bootWorkbench()
  })

  onBeforeUnmount(() => {
    invalidateTransport()
  })

  async function bootWorkbench(forceNewSession = false): Promise<void> {
    const lifecycleId = beginBootCycle()
    const state = await request(() => getCurrentProject(), '项目状态加载失败', {
      lifecycleId
    })
    if (!isActiveLifecycle(lifecycleId)) {
      return
    }
    const project = state?.current_project
    if (!project) {
      errorMessage.value = 'project.current_required: 请先选择项目目录'
      return
    }
    applyProjectState(state)
    if (!forceNewSession) {
      const restored = await tryRestoreSession(project.path, lifecycleId)
      if (!isActiveLifecycle(lifecycleId)) {
        return
      }
      if (restored) {
        void loadSidebarData()
        return
      }
    }
    contextLoading.value = true
    const generatedContext = await request(
      () => generateProjectContext(false),
      '项目上下文生成失败',
      { lifecycleId }
    )
    contextLoading.value = false
    if (!generatedContext || !isActiveLifecycle(lifecycleId)) {
      return
    }
    contextState.value = generatedContext
    const created = await request(
      () => createCodexTerminalSession(project.path),
      '终端会话创建失败',
      { lifecycleId }
    )
    if (!created) {
      return
    }
    if (!isActiveLifecycle(lifecycleId)) {
      void closeCodexTerminalSession(created.session_id)
      return
    }
    startSessionTransport(created, 0)
    void loadSidebarData()
  }

  function beginBootCycle(): number {
    workbenchLifecycleId += 1
    invalidateTransport()
    resetTerminalState()
    resetSidebarState()
    errorMessage.value = ''
    return workbenchLifecycleId
  }

  function startSessionTransport(
    nextSession: CodexTerminalSessionResponse,
    cursor: number
  ): void {
    session.value = nextSession
    saveSessionState(currentProjectPath.value, nextSession.session_id, cursor)
    terminalConnection.start({
      projectPath: currentProjectPath.value,
      sessionId: nextSession.session_id,
      cursor
    })
  }

  async function handleRestart(): Promise<void> {
    await closeActiveSession()
    clearStoredCodexSession(currentProjectPath.value)
    await bootWorkbench(true)
  }

  async function handleSubmitInput(data: string): Promise<void> {
    await request(
      () => terminalConnection.write(data),
      '终端输入写入失败'
    )
  }

  async function handleInsert(payload: string): Promise<void> {
    terminalPanelRef.value?.focusTerminal()
    await handleSubmitInput(payload)
  }

  async function closeActiveSession(): Promise<void> {
    workbenchLifecycleId += 1
    invalidateTransport()
    const activeSession = session.value
    if (!activeSession) {
      return
    }
    const closed = await request(
      () => closeCodexTerminalSession(activeSession.session_id),
      '终端会话关闭失败'
    )
    if (closed) {
      session.value = closed
    }
    clearStoredCodexSession(currentProjectPath.value)
  }

  async function request<T>(
    action: () => Promise<T>,
    fallbackMessage: string,
    options: { readonly lifecycleId?: number } = {}
  ): Promise<T | null> {
    try {
      return await action()
    } catch (error) {
      if (
        typeof options.lifecycleId === 'number' &&
        !isActiveLifecycle(options.lifecycleId)
      ) {
        return null
      }
      errorMessage.value = buildErrorMessage(error, fallbackMessage)
      return null
    }
  }

  function invalidateTransport(): void {
    terminalConnection.stop()
    connectionState = createTerminalConnectionState()
  }

  function handleMissingSession(): void {
    workbenchLifecycleId += 1
    session.value = null
    errorMessage.value = MISSING_SESSION_MESSAGE
    clearStoredCodexSession(currentProjectPath.value)
    terminalPanelRef.value?.reset()
  }

  function isActiveLifecycle(lifecycleId: number): boolean {
    return lifecycleId === workbenchLifecycleId
  }

  async function loadSidebarData(): Promise<void> {
    overviewLoading.value = true
    overviewErrorMessage.value = ''
    connections.value = []
    try {
      const overview = await getRemoteOverview()
      connections.value = overview.data_connections
    } catch (error) {
      overviewErrorMessage.value = buildErrorMessage(error, '远程概览加载失败')
    } finally {
      overviewLoading.value = false
    }
  }

  function resetTerminalState(): void {
    session.value = null
    terminalPanelRef.value?.reset()
  }

  function resetSidebarState(): void {
    currentProjectPath.value = ''
    contextLoading.value = false
    contextState.value = null
    connections.value = []
    overviewLoading.value = false
    overviewErrorMessage.value = ''
    directoryPanelKey.value += 1
  }

  function applyProjectState(state: ProjectCurrentStateResponse): void {
    currentProjectPath.value = state.current_project?.path ?? ''
    contextState.value = toProjectContextResponse(state)
  }

  async function tryRestoreSession(
    projectPath: string,
    lifecycleId: number
  ): Promise<boolean> {
    const stored = loadStoredCodexSession(projectPath)
    if (!stored) {
      return false
    }
    try {
      const restored = await getCodexTerminalSession(stored.session_id)
      if (!isActiveLifecycle(lifecycleId)) {
        return true
      }
      if (restored.status !== 'running') {
        clearStoredCodexSession(projectPath, stored.session_id)
        return false
      }
      startSessionTransport(restored, stored.next_cursor)
      return true
    } catch (error) {
      if (error instanceof ApiError && error.code === 'codex.session_not_found') {
        clearStoredCodexSession(projectPath)
        return false
      }
      errorMessage.value = buildErrorMessage(error, '终端会话恢复失败')
      return true
    }
  }

  function patchSessionStatus(
    sessionId: string,
    status: CodexTerminalSessionResponse['status']
  ): void {
    if (session.value?.session_id !== sessionId) {
      return
    }
    session.value = {
      ...session.value,
      status
    }
  }

  function patchConnectionStatus(
    status: 'idle' | 'booting' | 'streaming' | 'closed' | 'failed'
  ): void {
    if (status === 'idle') {
      connectionState = createTerminalConnectionState()
      return
    }
    if (status === 'booting') {
      connectionState = startBooting(connectionState)
      return
    }
    if (status === 'streaming') {
      connectionState = markStreaming(connectionState)
      if (session.value) {
        patchSessionStatus(session.value.session_id, 'running')
      }
      return
    }
    if (status === 'closed') {
      connectionState = markClosed(connectionState)
      if (session.value) {
        patchSessionStatus(session.value.session_id, 'closed')
      }
      return
    }
    connectionState = markFailed(connectionState, errorMessage.value)
    if (session.value) {
      patchSessionStatus(session.value.session_id, 'failed')
    }
  }

  return {
    connections,
    contextLoading,
    contextState,
    currentProjectPath,
    directoryPanelKey,
    errorMessage,
    handleInsert,
    handleRestart,
    handleSubmitInput,
    overviewErrorMessage,
    overviewLoading,
    session,
    terminalPanelRef
  }
}
