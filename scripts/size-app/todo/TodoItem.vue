<script lang="ts">
export interface Todo {
  id: number
  text: string
  done: boolean
}
</script>

<script setup lang="ts">
import { inject, nextTick, ref, useTemplateRef } from 'vue'
import { themeKey } from './keys'

const props = defineProps<{ todo: Todo }>()
const emit = defineEmits<{ remove: [] }>()

const theme = inject(themeKey)
const editing = ref(false)
const draft = ref('')
const input = useTemplateRef<HTMLInputElement>('input')

async function edit() {
  draft.value = props.todo.text
  editing.value = true
  await nextTick()
  input.value!.focus()
}

function save() {
  if (!editing.value) return
  editing.value = false
  const text = draft.value.trim()
  if (text) props.todo.text = text
  else emit('remove')
}
</script>

<template>
  <li
    :class="{ done: todo.done, editing }"
    :style="{ color: theme === 'dark' ? '#eee' : '#222' }"
  >
    <input
      v-if="editing"
      ref="input"
      v-model="draft"
      @keyup.enter="save"
      @keyup.esc="editing = false"
      @blur="save"
    />
    <template v-else>
      <input v-model="todo.done" type="checkbox" />
      <label @dblclick="edit">{{ todo.text }}</label>
      <button @click="emit('remove')">×</button>
    </template>
  </li>
</template>
