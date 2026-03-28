<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import CodexWorkbenchSidebar from '../components/CodexWorkbenchSidebar.vue'
import TerminalSessionPanel from '../components/TerminalSessionPanel.vue'
import { createCodexTerminalStreamController } from '../components/terminal/codex-terminal-stream-controller'
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

const MISSING_SESSION_MESSAGE = 'codex.session_not_found: 终端会话不存在，请重新创建会话'

const currentProjectPath = ref('')
const contextLoading = ref(false)
const contextState = ref<ProjectContextResponse | null>(null)
const connections = ref<readonly DatasourceConnectionResponse[]>([])
const overviewLoading = ref(false)
const overviewErrorMessage = ref('')
const directoryPanelKey = ref(0)
const session = ref<CodexTerminalSessionResponse | null>(null)
const terminalPanelRef = ref<InstanceType<typeof TerminalSessionPanel> | null>(null)
const errorMessage = ref('')

let workbenchLifecycleId = 0

const streamController = createCodexTerminalStreamController({
  buildEventStreamUrl: buildCodexTerminalEventStreamUrl,
  createEventSource: (url) => new EventSource(url),
  readStreamChunk: streamCodexTerminalSession,
  schedulePoll: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearScheduledPoll: (timerId) => window.clearTimeout(timerId)
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
  if (!state?.current_project) {
    errorMessage.value = 'project.current_required: 请先选择项目目录'
    return
  }
  applyProjectState(state)
  if (!forceNewSession) {
    const restored = await tryRestoreSession(state.current_project.path, lifecycleId)
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
    () => createCodexTerminalSession(state.current_project.path),
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
  saveSessionState(nextSession.session_id, cursor)
  streamController.start({
    projectPath: currentProjectPath.value,
    sessionId: nextSession.session_id,
    cursor,
    preferredTransport: resolvePreferredTransport(),
    onChunk: (chunk) => terminalPanelRef.value?.appendOutput(chunk),
    onError: (message) => {
      errorMessage.value = message
    },
    onStatus: (status) => {
      patchSessionStatus(nextSession.session_id, status)
    },
    onMissingSession: () => {
      handleMissingSession()
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
    () => writeCodexTerminalInput(session.value.session_id, data),
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
  if (!session.value) {
    return
  }
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
  options: { lifecycleId?: number } = {}
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
  streamController.bumpLifecycle()
}

function buildErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'codex.session_not_found') {
      return MISSING_SESSION_MESSAGE
    }
    return error.code ? `${error.code}: ${error.message}` : error.message
  }
  return error instanceof Error ? error.message : fallbackMessage
}

function handleMissingSession(): void {
  workbenchLifecycleId += 1
  session.value = null
  errorMessage.value = MISSING_SESSION_MESSAGE
  clearStoredCodexSession(currentProjectPath.value)
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

function saveSessionState(sessionId: string, cursor: number): void {
  if (!currentProjectPath.value) {
    return
  }
  saveStoredCodexSession({
    project_path: currentProjectPath.value,
    session_id: sessionId,
    next_cursor: cursor
  })
}

function resolvePreferredTransport(): 'sse' | 'polling' {
  return typeof window !== 'undefined' && typeof window.EventSource !== 'undefined'
    ? 'sse'
    : 'polling'
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
