<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import CodexWorkbenchSidebar from '../components/CodexWorkbenchSidebar.vue'
import TerminalSessionPanel from '../components/TerminalSessionPanel.vue'
import {
  ApiError,
  closeCodexTerminalSession,
  createCodexTerminalSession,
  generateProjectContext,
  getCurrentProject,
  getRemoteDirectories,
  getRemoteOverview,
  streamCodexTerminalSession,
  writeCodexTerminalInput
} from '../lib/api'
import type {
  CodexTerminalSessionResponse,
  DatasourceConnectionResponse,
  ProjectContextResponse
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
let terminalLifecycleId = 0

onMounted(() => {
  void bootWorkbench()
})

onBeforeUnmount(() => {
  stopPolling()
  void closeActiveSession()
})

async function bootWorkbench(): Promise<void> {
  terminalLifecycleId += 1
  const lifecycleId = terminalLifecycleId
  stopPolling()
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
  currentProjectPath.value = state.current_project.path
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
  await pollOutput(created.session_id, lifecycleId)
  void loadSidebarData()
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

async function handleRestart(): Promise<void> {
  await closeActiveSession()
  await bootWorkbench()
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
  stopPolling()
  const sessionId = session.value.session_id
  const closed = await request(
    () => closeCodexTerminalSession(sessionId),
    '终端会话关闭失败'
  )
  if (closed) {
    session.value = closed
  }
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
  stopPolling()
  session.value = null
  terminalOutput.value = ''
  nextCursor.value = 0
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
