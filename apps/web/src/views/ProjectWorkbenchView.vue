<script setup lang="ts">
import { ElAlert, ElButton, ElCard, ElDescriptions, ElDescriptionsItem, ElEmpty, ElForm, ElFormItem, ElInput, ElSkeleton } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import DataConnectionPanel from '../components/DataConnectionPanel.vue'
import RemoteDirectoryPanel from '../components/RemoteDirectoryPanel.vue'
import { ApiError, getCurrentProject, getRemoteDirectories, getRemoteOverview, saveRemoteProfile, selectProject, selectProjectWithDialog, testRemoteProfile } from '../lib/api'
import type { CurrentProjectResponse, RemoteOverviewResponse, RemoteProfileResponse } from '../lib/types'

interface RemoteProfileForm {
  base_url: string
  username: string
  password: string
  designer_root: string
}

const currentProject = ref<CurrentProjectResponse | null>(null)
const errorMessage = ref('')
const overviewErrorMessage = ref('')
const connectionMessage = ref('')
const connectionMessageType = ref<'info' | 'success'>('info')
const overview = ref<RemoteOverviewResponse | null>(null)
const overviewLoading = ref(false)
const remoteTreeVersion = ref(0)
const manualProjectPath = ref('')
const form = reactive<RemoteProfileForm>({
  base_url: '',
  username: '',
  password: '',
  designer_root: ''
})

const canUseRemoteProfile = computed(() => {
  return Boolean(
    currentProject.value &&
      form.base_url.trim() &&
      form.username.trim() &&
      form.password.trim() &&
      form.designer_root.trim()
  )
})

onMounted(() => {
  void loadCurrentState()
})

async function loadCurrentState(): Promise<void> {
  clearTopFeedback()
  const state = await runTopLevelRequest(getCurrentProject, '项目状态加载失败')
  if (!state) {
    resetOverviewState()
    return
  }
  applyProjectState(state.current_project, state.remote_profile)
  await refreshOverview()
}

async function handleChooseDirectory(): Promise<void> {
  clearTopFeedback()
  const state = await runTopLevelRequest(selectProjectWithDialog, '项目目录选择失败')
  if (!state) {
    return
  }
  applyProjectState(state.current_project, state.remote_profile)
  await refreshOverview()
}

async function handleApplyProjectPath(): Promise<void> {
  clearTopFeedback()
  const path = manualProjectPath.value.trim()
  if (!path) {
    errorMessage.value = '请输入项目目录路径'
    return
  }
  const state = await runTopLevelRequest(() => selectProject(path), '项目目录选择失败')
  if (!state) {
    return
  }
  applyProjectState(state.current_project, state.remote_profile)
  await refreshOverview()
}

async function handleSaveProfile(): Promise<void> {
  clearTopFeedback()
  const response = await runTopLevelRequest(() => saveRemoteProfile({ ...form }), '远程参数保存失败')
  if (!response) {
    return
  }
  applyRemoteProfile(response.remote_profile)
  connectionMessageType.value = 'success'
  connectionMessage.value = '远程参数已保存'
}

async function handleTestConnection(): Promise<void> {
  clearTopFeedback()
  const result = await runTopLevelRequest(() => testRemoteProfile({ ...form }), '远程连接测试失败')
  if (!result) {
    return
  }
  connectionMessageType.value = 'success'
  connectionMessage.value = `${result.status}: ${result.message}`
  await refreshOverview()
}

async function refreshOverview(): Promise<void> {
  resetOverviewState()
  if (!canUseRemoteProfile.value) {
    return
  }
  overviewLoading.value = true
  try {
    overview.value = await getRemoteOverview()
  } catch (error) {
    overviewErrorMessage.value = buildErrorMessage(error, '远程概览加载失败')
  } finally {
    overviewLoading.value = false
  }
}

async function runTopLevelRequest<T>(request: () => Promise<T>, fallbackMessage: string): Promise<T | null> {
  try {
    return await request()
  } catch (error) {
    errorMessage.value = buildErrorMessage(error, fallbackMessage)
    return null
  }
}

function clearTopFeedback(): void {
  errorMessage.value = ''
  connectionMessage.value = ''
}

function resetOverviewState(): void {
  overview.value = null
  overviewErrorMessage.value = ''
  remoteTreeVersion.value += 1
}

function applyProjectState(project: CurrentProjectResponse | null, profile: RemoteProfileResponse | null): void {
  currentProject.value = project
  manualProjectPath.value = project?.path ?? ''
  applyRemoteProfile(profile)
}

function applyRemoteProfile(profile: RemoteProfileResponse | null): void {
  form.base_url = profile?.base_url ?? ''
  form.username = profile?.username ?? ''
  form.password = profile?.password ?? ''
  form.designer_root = profile?.designer_root ?? ''
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
        <h2>项目与远程工作台</h2>
        <p>在同一页完成项目目录选择、远程参数维护和远端目录浏览。</p>
      </div>
      <ElButton plain @click="loadCurrentState">重新载入</ElButton>
    </header>
    <ElAlert v-if="errorMessage" :closable="false" show-icon title="请求失败" type="error" :description="errorMessage" />
    <ElCard class="workbench-view__card" shadow="never">
      <template #header>
        <div class="workbench-view__card-header">
          <div>
            <h3>项目目录</h3>
            <p>可通过本地系统目录选择器选择；若系统对话框不可用，可直接输入路径。</p>
          </div>
          <div class="workbench-view__actions">
            <ElButton plain @click="handleApplyProjectPath">应用路径</ElButton>
            <ElButton type="primary" @click="handleChooseDirectory">选择目录</ElButton>
          </div>
        </div>
      </template>
      <ElForm label-position="top" class="workbench-view__form workbench-view__form--project">
        <ElFormItem label="项目目录路径">
          <ElInput
            v-model="manualProjectPath"
            clearable
            placeholder="/Users/name/workspace/project"
          />
        </ElFormItem>
      </ElForm>
      <ElDescriptions v-if="currentProject" :column="1" border>
        <ElDescriptionsItem label="当前路径">{{ currentProject.path }}</ElDescriptionsItem>
        <ElDescriptionsItem label="项目名称">{{ currentProject.name }}</ElDescriptionsItem>
      </ElDescriptions>
      <ElEmpty v-else description="请先选择项目目录" />
    </ElCard>
    <ElCard class="workbench-view__card" shadow="never">
      <template #header>
        <div class="workbench-view__card-header workbench-view__card-header--stacked">
          <div>
            <h3>远程参数</h3>
            <p>当前项目只维护一套启用中的远程参数。</p>
          </div>
          <div class="workbench-view__actions">
            <ElButton plain :disabled="!canUseRemoteProfile" @click="handleTestConnection">测试连接</ElButton>
            <ElButton type="primary" :disabled="!canUseRemoteProfile" @click="handleSaveProfile">保存参数</ElButton>
          </div>
        </div>
      </template>
      <ElForm label-position="top" class="workbench-view__form">
        <ElFormItem label="服务地址">
          <ElInput v-model="form.base_url" clearable placeholder="http://127.0.0.1:8075/webroot/decision" />
        </ElFormItem>
        <ElFormItem label="用户名"><ElInput v-model="form.username" clearable placeholder="admin" /></ElFormItem>
        <ElFormItem label="密码">
          <ElInput v-model="form.password" clearable show-password type="password" placeholder="admin" />
        </ElFormItem>
        <ElFormItem label="FineReport 运行时目录">
          <ElInput
            v-model="form.designer_root"
            clearable
            placeholder="请输入 FineReport 运行时目录"
          />
        </ElFormItem>
      </ElForm>
      <ElAlert v-if="connectionMessage" :closable="false" show-icon :title="connectionMessage" :type="connectionMessageType" />
    </ElCard>
    <ElCard class="workbench-view__card" shadow="never">
      <template #header>
        <div class="workbench-view__card-header">
          <div>
            <h3>远程概览</h3>
            <p>远程目录树和数据连接使用同一组参数刷新。</p>
          </div>
          <ElButton plain :disabled="!canUseRemoteProfile" @click="refreshOverview">刷新概览</ElButton>
        </div>
      </template>
      <ElEmpty v-if="!canUseRemoteProfile" description="请先选择项目目录并填写远程参数" />
      <div v-else class="workbench-view__overview">
        <RemoteDirectoryPanel :key="remoteTreeVersion" :load-entries="getRemoteDirectories" />
        <div class="workbench-view__overview-side">
          <ElSkeleton v-if="overviewLoading" animated :rows="6" />
          <ElAlert
            v-else-if="overviewErrorMessage"
            :closable="false"
            show-icon
            title="远程概览加载失败"
            type="error"
            :description="overviewErrorMessage"
          />
          <DataConnectionPanel v-else-if="overview" :connections="overview.data_connections" />
          <ElEmpty v-else description="请刷新远程概览" />
        </div>
      </div>
    </ElCard>
  </section>
</template>

<style scoped>
.workbench-view { display: grid; gap: 20px; }
.workbench-view__header,
.workbench-view__card-header,
.workbench-view__actions {
  display: flex;
  gap: 16px;
}
.workbench-view__header,
.workbench-view__card-header {
  align-items: flex-start;
  justify-content: space-between;
}
.workbench-view__header h2,
.workbench-view__header p,
.workbench-view__card-header h3,
.workbench-view__card-header p {
  margin: 0;
}
.workbench-view__header p,
.workbench-view__card-header p {
  color: #61758a;
}
.workbench-view__card { border: 1px solid #d8e1ef; border-radius: 24px; }
.workbench-view__form { display: grid; gap: 8px; }
.workbench-view__form--project { margin-bottom: 16px; }
.workbench-view__overview { display: grid; gap: 20px; }
.workbench-view__overview-side { display: grid; }

@media (min-width: 980px) {
  .workbench-view__overview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workbench-view__form { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .workbench-view__header,
  .workbench-view__card-header,
  .workbench-view__actions {
    flex-direction: column;
  }

  .workbench-view__actions > * { width: 100%; }
}
</style>
