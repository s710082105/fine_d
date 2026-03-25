<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import TerminalSessionPanel from '../components/TerminalSessionPanel.vue'
import {
  ApiError,
  closeCodexTerminalSession,
  createCodexTerminalSession,
  getCurrentProject,
  streamCodexTerminalSession,
  writeCodexTerminalInput
} from '../lib/api'
import type { CodexTerminalSessionResponse } from '../lib/types'

const session = ref<CodexTerminalSessionResponse | null>(null)
const terminalOutput = ref('')
const errorMessage = ref('')
const nextCursor = ref(0)

let pollTimer: number | null = null

onMounted(() => {
  void createSession()
})

onBeforeUnmount(() => {
  stopPolling()
  void closeActiveSession()
})

async function createSession(): Promise<void> {
  stopPolling()
  session.value = null
  terminalOutput.value = ''
  nextCursor.value = 0
  errorMessage.value = ''
  const state = await request(() => getCurrentProject(), '项目状态加载失败')
  if (!state?.current_project) {
    errorMessage.value = 'project.current_required: 请先选择项目目录'
    return
  }
  const created = await request(
    () => createCodexTerminalSession(state.current_project!.path),
    '终端会话创建失败'
  )
  if (!created) {
    return
  }
  session.value = created
  await pollOutput()
}

async function pollOutput(): Promise<void> {
  if (!session.value) {
    return
  }
  const currentSession = session.value
  const chunk = await request(
    () => streamCodexTerminalSession(currentSession.session_id, nextCursor.value),
    '终端输出读取失败'
  )
  if (!chunk || !session.value) {
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
      void pollOutput()
    }, 300)
  }
}

async function handleRestart(): Promise<void> {
  await closeActiveSession()
  await createSession()
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

async function closeActiveSession(): Promise<void> {
  if (!session.value) {
    return
  }
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
  fallbackMessage: string
): Promise<T | null> {
  try {
    return await action()
  } catch (error) {
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
    return error.code ? `${error.code}: ${error.message}` : error.message
  }
  return error instanceof Error ? error.message : fallbackMessage
}
</script>

<template>
  <TerminalSessionPanel
    :session="session"
    :output="terminalOutput"
    :error-message="errorMessage"
    @restart="handleRestart"
    @submit-input="handleSubmitInput"
  />
</template>
