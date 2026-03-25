<script setup lang="ts">
import { computed, ref } from 'vue'

import AppLayout from './components/AppLayout.vue'
import SideNav from './components/SideNav.vue'
import type { AppSection, SectionId } from './lib/types'
import CodexTerminalView from './views/CodexTerminalView.vue'
import ProjectWorkbenchView from './views/ProjectWorkbenchView.vue'

const sections: ReadonlyArray<AppSection> = [
  {
    id: 'workbench',
    label: '项目与远程概览',
    summary: '选择本机项目目录，维护远程参数，并查看远程目录和数据连接。'
  },
  {
    id: 'codex',
    label: 'Codex',
    summary: '直接承载 Codex 终端会话，并在页面内桥接输入输出。'
  }
]

const activeSection = ref<SectionId>('workbench')

const currentSection = computed(() => {
  return sections.find((section) => section.id === activeSection.value) ?? sections[0]
})

function handleSectionSelect(sectionId: SectionId): void {
  activeSection.value = sectionId
}
</script>

<template>
  <AppLayout>
    <template #sidebar>
      <SideNav
        :sections="sections"
        :active-section="activeSection"
        @select="handleSectionSelect"
      />
    </template>
    <template #header>
      <div class="app-shell__header">
        <div>
          <p class="app-shell__eyebrow">本地工作台</p>
          <h1>FineReport 项目工作台</h1>
        </div>
        <p class="app-shell__summary">{{ currentSection.summary }}</p>
      </div>
    </template>
    <ProjectWorkbenchView
      v-if="activeSection === 'workbench'"
      class="app-shell__view"
    />
    <CodexTerminalView v-else class="app-shell__view" />
  </AppLayout>
</template>

<style scoped>
.app-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 32px;
}

.app-shell__eyebrow {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: #5e738c;
}

h1 {
  margin: 0;
  font-size: 28px;
}

.app-shell__summary {
  max-width: 360px;
  margin: 0;
  color: #4c627c;
}

.app-shell__view {
  border-radius: 24px;
  padding: 32px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 20px 45px rgba(16, 32, 51, 0.08);
}

@media (max-width: 960px) {
  .app-shell__header {
    flex-direction: column;
    align-items: flex-start;
    padding: 20px 24px;
  }

  .app-shell__summary {
    max-width: none;
  }
}
</style>
