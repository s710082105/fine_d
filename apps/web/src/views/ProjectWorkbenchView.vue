<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import DataConnectionPanel from '../components/DataConnectionPanel.vue'
import RemoteDirectoryPanel from '../components/RemoteDirectoryPanel.vue'
import {
  ApiError,
  getCurrentProject,
  getRemoteOverview,
  saveRemoteProfile,
  selectProjectWithDialog,
  testRemoteProfile
} from '../lib/api'
import type {
  CurrentProjectResponse,
  RemoteOverviewResponse,
  RemoteProfileResponse
} from '../lib/types'

interface RemoteProfileForm {
  base_url: string
  username: string
  password: string
}

const currentProject = ref<CurrentProjectResponse | null>(null)
const errorMessage = ref('')
const overviewErrorMessage = ref('')
const connectionMessage = ref('')
const overview = ref<RemoteOverviewResponse | null>(null)
const overviewLoading = ref(false)
const form = reactive<RemoteProfileForm>({
  base_url: '',
  username: '',
  password: ''
})

const canUseRemoteProfile = computed(() => {
  return Boolean(currentProject.value && form.base_url && form.username && form.password)
})

onMounted(() => {
  void loadCurrentState()
})

async function loadCurrentState(): Promise<void> {
  errorMessage.value = ''
  connectionMessage.value = ''
  const state = await handleRequest(() => getCurrentProject(), '项目状态加载失败')
  if (!state) {
    return
  }
  applyProjectState(state.current_project, state.remote_profile)
  if (canUseRemoteProfile.value) {
    await loadOverview()
    return
  }
  overview.value = null
}

async function handleChooseDirectory(): Promise<void> {
  connectionMessage.value = ''
  const state = await handleRequest(
    () => selectProjectWithDialog(),
    '项目目录选择失败'
  )
  if (!state) {
    return
  }
  applyProjectState(state.current_project, state.remote_profile)
  if (canUseRemoteProfile.value) {
    await loadOverview()
    return
  }
  overview.value = null
}

async function handleSaveProfile(): Promise<void> {
  connectionMessage.value = ''
  const response = await handleRequest(
    () => saveRemoteProfile({ ...form }),
    '远程参数保存失败'
  )
  if (!response) {
    return
  }
  applyRemoteProfile(response.remote_profile)
  connectionMessage.value = '远程参数已保存'
}

async function handleTestConnection(): Promise<void> {
  connectionMessage.value = ''
  const result = await handleRequest(
    () => testRemoteProfile({ ...form }),
    '远程连接测试失败'
  )
  if (!result) {
    return
  }
  connectionMessage.value = `${result.status}: ${result.message}`
  await loadOverview()
}

async function loadOverview(): Promise<void> {
  overviewErrorMessage.value = ''
  overviewLoading.value = true
  const response = await handleRequest(() => getRemoteOverview(), '远程概览加载失败')
  overviewLoading.value = false
  if (!response) {
    overview.value = null
    overviewErrorMessage.value = errorMessage.value
    return
  }
  overview.value = response
}

async function handleRequest<T>(
  request: () => Promise<T>,
  fallbackMessage: string
): Promise<T | null> {
  try {
    return await request()
  } catch (error) {
    errorMessage.value = buildErrorMessage(error, fallbackMessage)
    return null
  }
}

function applyProjectState(
  project: CurrentProjectResponse | null,
  profile: RemoteProfileResponse | null
): void {
  currentProject.value = project
  applyRemoteProfile(profile)
}

function applyRemoteProfile(profile: RemoteProfileResponse | null): void {
  form.base_url = profile?.base_url ?? ''
  form.username = profile?.username ?? ''
  form.password = profile?.password ?? ''
}

function buildErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    return error.code ? `${error.code}: ${error.message}` : error.message
  }
  return error instanceof Error ? error.message : fallbackMessage
}
</script>

<template>
  <section class="workbench-view">
    <header class="workbench-view__header">
      <div>
        <h2>项目与远程概览</h2>
        <p>在同一页完成项目目录选择、远程参数维护和远端概览查看。</p>
      </div>
      <button type="button" class="workbench-view__secondary" @click="loadCurrentState">
        重新载入
      </button>
    </header>

    <p v-if="errorMessage" class="workbench-view__error" role="alert">
      {{ errorMessage }}
    </p>

    <section class="workbench-view__panel">
      <div class="workbench-view__panel-header">
        <div>
          <h3>项目目录</h3>
          <p>项目目录通过本地系统目录选择器确定。</p>
        </div>
        <button type="button" @click="handleChooseDirectory">选择目录</button>
      </div>
      <p v-if="currentProject" class="workbench-view__path">{{ currentProject.path }}</p>
      <p v-else class="workbench-view__empty">请先选择项目目录</p>
    </section>

    <section class="workbench-view__panel">
      <div class="workbench-view__panel-header">
        <div>
          <h3>远程参数</h3>
          <p>当前项目只维护一套启用中的远程参数。</p>
        </div>
        <div class="workbench-view__actions">
          <button
            type="button"
            class="workbench-view__secondary"
            :disabled="!canUseRemoteProfile"
            @click="handleTestConnection"
          >
            测试连接
          </button>
          <button type="button" :disabled="!canUseRemoteProfile" @click="handleSaveProfile">
            保存参数
          </button>
        </div>
      </div>
      <form class="workbench-view__form" @submit.prevent="handleSaveProfile">
        <label>
          服务地址
          <input v-model="form.base_url" type="url" placeholder="http://127.0.0.1:8075/webroot/decision" />
        </label>
        <label>
          用户名
          <input v-model="form.username" type="text" placeholder="admin" />
        </label>
        <label>
          密码
          <input v-model="form.password" type="password" placeholder="admin" />
        </label>
      </form>
      <p v-if="connectionMessage" class="workbench-view__hint">{{ connectionMessage }}</p>
    </section>

    <section class="workbench-view__panel">
      <div class="workbench-view__panel-header">
        <div>
          <h3>远程概览</h3>
          <p>远程目录和数据连接使用同一组参数刷新。</p>
        </div>
        <button
          type="button"
          class="workbench-view__secondary"
          :disabled="!canUseRemoteProfile"
          @click="loadOverview"
        >
          刷新概览
        </button>
      </div>
      <p v-if="overviewLoading" class="workbench-view__hint">远程概览加载中...</p>
      <p v-else-if="overviewErrorMessage" class="workbench-view__error" role="alert">
        {{ overviewErrorMessage }}
      </p>
      <div v-else class="workbench-view__overview">
        <RemoteDirectoryPanel :entries="overview?.directory_entries ?? []" />
        <DataConnectionPanel :connections="overview?.data_connections ?? []" />
      </div>
    </section>
  </section>
</template>

<style scoped>
.workbench-view {
  display: grid;
  gap: 24px;
}

.workbench-view__header,
.workbench-view__panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.workbench-view__header h2,
.workbench-view__header p,
.workbench-view__panel-header h3,
.workbench-view__panel-header p,
.workbench-view__hint,
.workbench-view__empty {
  margin: 0;
}

.workbench-view__header p,
.workbench-view__panel-header p,
.workbench-view__hint,
.workbench-view__empty {
  color: #5e738c;
}

.workbench-view__panel {
  display: grid;
  gap: 16px;
  padding: 24px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(35, 65, 95, 0.08);
}

.workbench-view__path,
.workbench-view__error {
  margin: 0;
  word-break: break-all;
}

.workbench-view__error {
  padding: 14px 16px;
  border-radius: 16px;
  background: #fff1f0;
  color: #a12d2d;
}

.workbench-view__form,
.workbench-view__overview {
  display: grid;
  gap: 16px;
}

.workbench-view__form label {
  display: grid;
  gap: 8px;
  font-weight: 600;
}

.workbench-view__form input {
  border: 1px solid #d6dfeb;
  border-radius: 14px;
  padding: 12px 14px;
  font: inherit;
}

.workbench-view__actions {
  display: flex;
  gap: 12px;
}

.workbench-view button {
  border: 0;
  border-radius: 14px;
  padding: 12px 16px;
  background: #1363df;
  color: #ffffff;
  font: inherit;
  cursor: pointer;
}

.workbench-view button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.workbench-view__secondary {
  background: #e8f1ff !important;
  color: #1d4d8f !important;
}

@media (min-width: 980px) {
  .workbench-view__form {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .workbench-view__overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .workbench-view__header,
  .workbench-view__panel-header,
  .workbench-view__actions {
    flex-direction: column;
  }

  .workbench-view__actions {
    width: 100%;
  }
}
</style>
