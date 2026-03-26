<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import CodexWorkbenchSidebar from '../components/CodexWorkbenchSidebar.vue'
import TerminalSessionPanel from '../components/TerminalSessionPanel.vue'
import {
  ApiError,
  buildCodexTerminalEventStreamUrl,
  closeCodexTerminalSession,
  createCodexTerminalSession,
  generateProjectContext,
  getCodexTerminalSession,
  getCurrentProject,
  getRemoteDirectories,
  getRemoteOverview,
  streamCodexTerminalSession,
  writeCodexTerminalInput
} from '../lib/api'
import {
  clearStoredCodexSession,
  loadStoredCodexSession,
  saveStoredCodexSession
} from '../lib/codex-session-storage'
import type {
  CodexTerminalSessionResponse,
  DatasourceConnectionResponse,
  ProjectContextResponse,
  ProjectCurrentStateResponse
} from '../lib/types'

const currentProjectPath = ref('')
const contextLoading = ref(false)
const contextState = ref<ProjectContextResponse | null>(null)
const connections = ref<readonly DatasourceConnectionResponse[]>([])
const overviewLoading = ref(false)
const overviewErrorMessage = ref('')
const directoryPanelKey = ref(0)
const session = ref<CodexTerminalSessionResponse | null>(null)
const terminalPanelRef = ref<InstanceType<typeof TerminalSessionPanel> | null>(null)
const terminalOutput = ref('')
const errorMessage = ref('')
const nextCursor = ref(0)

let pollTimer: number | null = null
let streamSource: EventSource | null = null
let terminalLifecycleId = 0

onMounted(() => {
  void bootWorkbench()
})

onBeforeUnmount(() => {
  stopStreaming()
})

async function bootWorkbench(forceNewSession = false): Promise<void> {
  terminalLifecycleId += 1
  const lifecycleId = terminalLifecycleId
  stopStreaming()
  resetTerminalState()
  resetSidebarState()
  errorMessage.value = ''
  const state = await request(() => getCurrentProject(), '项目状态加载失败', {
    lifecycleId
  })
  if (!isActiveLifecycle(lifecycleId)) {
    return
  }
  if (!state?.current_project) {
    errorMessage.value = 'project.current_required: 请先选择项目目录'
    return
  }
  applyProjectState(state)
  if (!forceNewSession) {
    const restored = await tryRestoreSession(
      state.current_project.path,
      lifecycleId
    )
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
    {
      lifecycleId
    }
  )
  contextLoading.value = false
  if (!generatedContext || !isActiveLifecycle(lifecycleId)) {
    return
  }
  contextState.value = generatedContext
  const created = await request(
    () => createCodexTerminalSession(state.current_project!.path),
    '终端会话创建失败',
    {
      lifecycleId
    }
  )
  if (!created) {
    return
  }
  if (!isActiveLifecycle(lifecycleId)) {
    void closeCodexTerminalSession(created.session_id)
    return
  }
  session.value = created
  saveSessionState(created.session_id)
  await startOutputStream(created.session_id, lifecycleId)
  void loadSidebarData()
}

async function startOutputStream(
  sessionId: string,
  lifecycleId: number
): Promise<void> {
  if (typeof window !== 'undefined' && typeof window.EventSource !== 'undefined') {
    startEventStream(sessionId, lifecycleId)
    return
  }
  await pollOutput(sessionId, lifecycleId)
}

async function pollOutput(
  sessionId: string,
  lifecycleId: number
): Promise<void> {
  if (!session.value || !isActiveSession(sessionId, lifecycleId)) {
    return
  }
  const chunk = await request(
    () => streamCodexTerminalSession(sessionId, nextCursor.value),
    '终端输出读取失败',
    {
      lifecycleId,
      onApiError: (error) => {
        if (error.code === 'codex.session_not_found') {
          handleMissingSession()
        }
      }
    }
  )
  if (!chunk || !isActiveSession(sessionId, lifecycleId)) {
    return
  }
  if (chunk.output) {
    terminalOutput.value += chunk.output
  }
  nextCursor.value = chunk.next_cursor
  saveSessionState(sessionId)
  session.value = {
    ...session.value,
    status: chunk.status
  }
  if (!chunk.completed) {
    pollTimer = window.setTimeout(() => {
      void pollOutput(sessionId, lifecycleId)
    }, 300)
  }
}

function startEventStream(sessionId: string, lifecycleId: number): void {
  stopStreaming()
  if (!isActiveSession(sessionId, lifecycleId)) {
    return
  }
  const source = new EventSource(
    buildCodexTerminalEventStreamUrl(sessionId, nextCursor.value)
  )
  streamSource = source
  source.addEventListener('terminal', (event) => {
    if (!isActiveSession(sessionId, lifecycleId)) {
      source.close()
      return
    }
    const message = event as MessageEvent<string>
    const chunk = JSON.parse(message.data) as {
      session_id: string
      status: CodexTerminalSessionResponse['status']
      output: string
      next_cursor: number
      completed: boolean
    }
    if (chunk.output) {
      terminalOutput.value += chunk.output
    }
    nextCursor.value = chunk.next_cursor
    saveSessionState(sessionId)
    if (session.value) {
      session.value = {
        ...session.value,
        status: chunk.status
      }
    }
    if (chunk.completed) {
      source.close()
      if (streamSource === source) {
        streamSource = null
      }
    }
  })
  source.addEventListener('terminal_error', (event) => {
    if (!isActiveSession(sessionId, lifecycleId)) {
      source.close()
      return
    }
    const message = event as MessageEvent<string>
    const payload = JSON.parse(message.data) as {
      code?: string
      message?: string
      detail?: unknown
      source?: string
      retryable?: boolean
    }
    if (payload.code === 'codex.session_not_found') {
      handleMissingSession()
    }
    errorMessage.value = payload.code && payload.message
      ? `${payload.code}: ${payload.message}`
      : '终端输出读取失败'
    source.close()
    if (streamSource === source) {
      streamSource = null
    }
  })
}

async function handleRestart(): Promise<void> {
  await closeActiveSession()
  clearStoredCodexSession(currentProjectPath.value)
  await bootWorkbench(true)
}

async function handleSubmitInput(data: string): Promise<void> {
  if (!session.value) {
    return
  }
  await request(
    () => writeCodexTerminalInput(session.value!.session_id, data),
    '终端输入写入失败'
  )
}

async function handleInsert(payload: string): Promise<void> {
  terminalPanelRef.value?.focusTerminal()
  await handleSubmitInput(payload)
}

async function closeActiveSession(): Promise<void> {
  if (!session.value) {
    return
  }
  terminalLifecycleId += 1
  stopStreaming()
  const sessionId = session.value.session_id
  const closed = await request(
    () => closeCodexTerminalSession(sessionId),
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
  options: {
    lifecycleId?: number
    onApiError?: (error: ApiError) => void
  } = {}
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
    if (error instanceof ApiError) {
      options.onApiError?.(error)
    }
    errorMessage.value = buildErrorMessage(error, fallbackMessage)
    return null
  }
}

function stopPolling(): void {
  if (pollTimer === null) {
    return
  }
  window.clearTimeout(pollTimer)
  pollTimer = null
}

function stopStreaming(): void {
  stopPolling()
  if (streamSource) {
    streamSource.close()
    streamSource = null
  }
}

function buildErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'codex.session_not_found') {
      return 'codex.session_not_found: 终端会话不存在，请重新创建会话'
    }
    return error.code ? `${error.code}: ${error.message}` : error.message
  }
  return error instanceof Error ? error.message : fallbackMessage
}

function handleMissingSession(): void {
  terminalLifecycleId += 1
  stopStreaming()
  session.value = null
  terminalOutput.value = ''
  nextCursor.value = 0
  clearStoredCodexSession(currentProjectPath.value)
}

function isActiveLifecycle(lifecycleId: number): boolean {
  return lifecycleId === terminalLifecycleId
}

function isActiveSession(sessionId: string, lifecycleId: number): boolean {
  return (
    isActiveLifecycle(lifecycleId) &&
    session.value?.session_id === sessionId
  )
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
  terminalOutput.value = ''
  nextCursor.value = 0
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

function toProjectContextResponse(
  state: ProjectCurrentStateResponse
): ProjectContextResponse | null {
  if (!state.current_project || !state.context_state) {
    return null
  }
  return {
    project_root: state.current_project.path,
    generated_at: state.context_state.generated_at,
    agents_status: state.context_state.agents_status,
    managed_files: []
  }
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
    session.value = restored
    nextCursor.value = stored.next_cursor
    saveSessionState(restored.session_id)
    await startOutputStream(restored.session_id, lifecycleId)
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

function saveSessionState(sessionId: string): void {
  if (!currentProjectPath.value) {
    return
  }
  saveStoredCodexSession({
    project_path: currentProjectPath.value,
    session_id: sessionId,
    next_cursor: nextCursor.value
  })
}
</script>

<template>
  <section class="codex-workbench">
    <CodexWorkbenchSidebar
      class="codex-workbench__sidebar"
      :project-path="currentProjectPath"
      :context-state="contextState"
      :context-loading="contextLoading"
      :connections="connections"
      :overview-loading="overviewLoading"
      :overview-error-message="overviewErrorMessage"
      :directory-panel-key="directoryPanelKey"
      :load-entries="getRemoteDirectories"
      @insert="handleInsert"
    />
    <div class="codex-workbench__terminal">
      <TerminalSessionPanel
        ref="terminalPanelRef"
        :session="session"
        :output="terminalOutput"
        :error-message="errorMessage"
        @restart="handleRestart"
        @submit-input="handleSubmitInput"
      />
    </div>
  </section>
</template>

<style scoped>
.codex-workbench {
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.codex-workbench__sidebar,
.codex-workbench__terminal {
  min-width: 0;
}

@media (max-width: 980px) {
  .codex-workbench {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
