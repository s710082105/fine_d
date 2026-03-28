<script setup lang="ts">
import CodexWorkbenchSidebar from '../components/CodexWorkbenchSidebar.vue'
import TerminalSessionPanel from '../components/TerminalSessionPanel.vue'
import { getRemoteDirectories } from '../lib/api'
import { useCodexTerminalWorkbench } from './use-codex-terminal-workbench'

const {
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
} = useCodexTerminalWorkbench()
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
