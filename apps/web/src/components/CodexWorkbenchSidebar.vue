<script setup lang="ts">
import { ElAlert, ElCard, ElDescriptions, ElDescriptionsItem, ElEmpty, ElSkeleton } from 'element-plus'
import { computed } from 'vue'

import type {
  DatasourceConnectionResponse,
  ProjectContextResponse,
  RemoteDirectoryLoader
} from '../lib/types'
import DataConnectionPanel from './DataConnectionPanel.vue'
import RemoteDirectoryPanel from './RemoteDirectoryPanel.vue'

const props = defineProps<{
  projectPath: string
  contextState: ProjectContextResponse | null
  contextLoading: boolean
  connections: ReadonlyArray<DatasourceConnectionResponse>
  overviewLoading: boolean
  overviewErrorMessage: string
  directoryPanelKey: number
  loadEntries: RemoteDirectoryLoader
}>()

const emit = defineEmits<{
  insert: [payload: string]
}>()

const contextStatusLabel = computed(() => {
  if (!props.contextState) {
    return ''
  }
  return CONTEXT_STATUS_LABELS[props.contextState.agents_status]
})

const hasContext = computed(() => Boolean(props.contextState))

const CONTEXT_STATUS_LABELS: Record<ProjectContextResponse['agents_status'], string> = {
  created: '已生成',
  kept: '沿用现有',
  updated: '已更新'
}
</script>

<template>
  <aside class="codex-sidebar">
    <ElCard shadow="never">
      <template #header>
        <div class="codex-sidebar__card-header">
          <div>
            <h3>项目上下文</h3>
            <p>启动终端前先生成项目级上下文文件。</p>
          </div>
        </div>
      </template>
      <ElSkeleton v-if="contextLoading" animated :rows="4" />
      <ElDescriptions v-else-if="hasContext" :column="1" border>
        <ElDescriptionsItem label="项目路径">
          {{ contextState!.project_root || projectPath }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="生成状态">
          {{ contextStatusLabel }}
        </ElDescriptionsItem>
        <ElDescriptionsItem label="生成时间">
          {{ contextState!.generated_at }}
        </ElDescriptionsItem>
      </ElDescriptions>
      <ElEmpty
        v-else
        description="项目上下文尚未生成"
      />
    </ElCard>

    <ElCard shadow="never">
      <DataConnectionPanel
        v-if="!overviewLoading && !overviewErrorMessage"
        :connections="connections"
        @insert="emit('insert', $event)"
      />
      <ElSkeleton v-else-if="overviewLoading" animated :rows="5" />
      <ElAlert
        v-else
        :closable="false"
        show-icon
        title="远程概览加载失败"
        type="error"
        :description="overviewErrorMessage"
      />
    </ElCard>

    <ElCard shadow="never">
      <RemoteDirectoryPanel
        :key="directoryPanelKey"
        :load-entries="loadEntries"
        @insert="emit('insert', $event)"
      />
    </ElCard>
  </aside>
</template>

<style scoped>
.codex-sidebar {
  display: grid;
  gap: 16px;
  align-content: start;
}

.codex-sidebar :deep(.el-card__body) {
  display: grid;
  gap: 16px;
}

.codex-sidebar__card-header h3,
.codex-sidebar__card-header p {
  margin: 0;
}

.codex-sidebar__card-header p {
  color: #61758a;
}
</style>
