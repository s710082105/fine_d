<script setup lang="ts">
import { ElAlert, ElTag, ElTree } from 'element-plus'
import type { LoadFunction } from 'element-plus'
import { ref } from 'vue'

import { ApiError } from '../lib/api'
import type {
  RemoteDirectoryEntryResponse,
  RemoteDirectoryLoader
} from '../lib/types'

interface RemoteDirectoryTreeNode extends RemoteDirectoryEntryResponse {
  readonly leaf: boolean
}

const props = defineProps<{
  loadEntries: RemoteDirectoryLoader
}>()

const loadErrorMessage = ref('')

const treeProps = {
  label: 'name',
  isLeaf: 'leaf'
} as const

const loadNode: LoadFunction = (node, resolve, stopLoading) => {
  void loadEntries(node, resolve, stopLoading)
}

async function loadEntries(
  node: { level: number; data: unknown },
  resolve: (nodes: RemoteDirectoryTreeNode[]) => void,
  stopLoading: () => void
): Promise<void> {
  loadErrorMessage.value = ''
  const path =
    node.level === 0 ? undefined : extractDirectoryPath(node.data)
  try {
    const entries = await props.loadEntries(path)
    resolve(entries.map(toTreeNode))
  } catch (error) {
    loadErrorMessage.value = buildErrorMessage(error, '远程目录加载失败')
    stopLoading()
  }
}

function toTreeNode(
  entry: RemoteDirectoryEntryResponse
): RemoteDirectoryTreeNode {
  return {
    ...entry,
    leaf: !entry.is_directory
  }
}

function extractDirectoryPath(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined
  }
  const path = (data as { path?: unknown }).path
  return typeof path === 'string' ? path : undefined
}

function buildErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    return error.code ? `${error.code}: ${error.message}` : error.message
  }
  return error instanceof Error ? error.message : fallbackMessage
}
</script>

<template>
  <section class="remote-panel">
    <header class="remote-panel__header">
      <div>
        <h3>远程目录</h3>
        <p>树形展示远端目录，按节点懒加载子目录。</p>
      </div>
    </header>
    <ElAlert
      v-if="loadErrorMessage"
      :closable="false"
      show-icon
      title="目录加载失败"
      type="error"
      :description="loadErrorMessage"
    />
    <ElTree
      v-else
      class="remote-panel__tree"
      empty-text="暂无远程目录数据"
      node-key="path"
      lazy
      highlight-current
      :expand-on-click-node="true"
      :load="loadNode"
      :props="treeProps"
    >
      <template #default="{ data }">
        <div class="remote-panel__node">
          <span class="remote-panel__name">{{ data.name }}</span>
          <div class="remote-panel__meta">
            <ElTag size="small" effect="plain" type="info">
              {{ data.is_directory ? '目录' : '文件' }}
            </ElTag>
            <ElTag
              v-if="data.lock"
              size="small"
              effect="plain"
              type="warning"
            >
              {{ data.lock }}
            </ElTag>
          </div>
        </div>
      </template>
    </ElTree>
  </section>
</template>

<style scoped>
.remote-panel {
  display: grid;
  gap: 16px;
}

.remote-panel__header h3,
.remote-panel__header p {
  margin: 0;
}

.remote-panel__header p {
  color: #61758a;
}

.remote-panel__tree {
  padding: 12px;
  border: 1px solid #d8e1ef;
  border-radius: 16px;
  background: #f8fbff;
}

.remote-panel__node,
.remote-panel__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remote-panel__node {
  width: 100%;
  justify-content: space-between;
}

.remote-panel__name {
  min-width: 0;
  word-break: break-all;
}

@media (max-width: 720px) {
  .remote-panel__node {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
