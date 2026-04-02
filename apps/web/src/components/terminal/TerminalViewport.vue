<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import {
  createTerminalAdapter,
  type TerminalAdapter
} from './xterm-adapter'

defineOptions({
  inheritAttrs: false
})

const props = defineProps<{
  onInput: (payload: string) => void
}>()

const hostRef = ref<HTMLElement | null>(null)
const adapter = ref<TerminalAdapter | null>(null)

function mountViewport(): void {
  if (!hostRef.value || adapter.value) {
    return
  }
  adapter.value = createTerminalAdapter(hostRef.value, {
    onInput: props.onInput
  })
  adapter.value.fit()
}

onMounted(() => {
  mountViewport()
})

onBeforeUnmount(() => {
  adapter.value?.destroy()
  adapter.value = null
})

defineExpose({
  appendOutput: (chunk: string) => adapter.value?.write(chunk) ?? Promise.resolve(),
  clear: () => adapter.value?.clear(),
  focus: () => adapter.value?.focus()
})
</script>

<template>
  <div ref="hostRef" class="terminal-viewport" />
</template>

<style scoped>
.terminal-viewport {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  min-width: 0;
  height: 520px;
  padding: 16px;
}

:deep(.xterm) {
  flex: 1;
  width: 100%;
  height: 100%;
}

:deep(.xterm-viewport) {
  width: 100% !important;
}
</style>
