<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  submit: [payload: string]
}>()

const value = ref('')

const canSubmit = computed(() => {
  return !props.disabled && value.value.trim().length > 0
})

function submit(): void {
  if (!canSubmit.value) {
    return
  }
  emit('submit', `${value.value}\r`)
  value.value = ''
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.isComposing || event.key !== 'Enter' || event.shiftKey) {
    return
  }
  event.preventDefault()
  submit()
}
</script>

<template>
  <div class="terminal-composer">
    <input
      v-model="value"
      class="terminal-composer__input"
      type="text"
      placeholder="输入命令后按 Enter 发送到 Codex"
      :disabled="disabled"
      @keydown="handleKeydown"
    />
    <button
      type="button"
      class="terminal-composer__submit"
      :disabled="!canSubmit"
      @click="submit"
    >
      发送
    </button>
  </div>
</template>

<style scoped>
.terminal-composer {
  display: flex;
  gap: 12px;
  align-items: center;
}

.terminal-composer__input {
  flex: 1;
  min-width: 0;
  border: 1px solid #c7d6e6;
  border-radius: 14px;
  padding: 12px 14px;
  background: #f9fbfe;
  color: #102033;
  font: inherit;
}

.terminal-composer__input:focus {
  outline: 2px solid rgba(19, 99, 223, 0.18);
  border-color: #1363df;
}

.terminal-composer__input:disabled,
.terminal-composer__submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.terminal-composer__submit {
  border: 0;
  border-radius: 14px;
  padding: 12px 16px;
  background: #1363df;
  color: #ffffff;
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .terminal-composer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
