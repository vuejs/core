<script setup lang="ts">
import { computed } from 'vue/vapor'
import { useLocalStorage } from '@vueuse/core'
interface Task {
  title: string
  completed: boolean
}

const tasks = useLocalStorage<Task[]>('tasks', [])
const value = useLocalStorage('value', '')

const remaining = computed(() => {
  return tasks.value.filter(task => !task.completed).length
})

function handleAdd(evt: MouseEvent) {
  console.log(evt)
  tasks.value.push({
    title: value.value,
    completed: false,
  })
  value.value = ''
}

function handleComplete(index: number, evt: Event) {
  tasks.value[index].completed = (evt.target as HTMLInputElement).checked
}

function handleClearComplete() {
  tasks.value = tasks.value.filter(task => !task.completed)
}

function handleClearAll() {
  tasks.value = []
}

function handleRemove(idx: number, task: Task) {
  console.log(task)
  tasks.value.splice(idx, 1)
}
</script>

<template>
  <h1>todos</h1>
  <ul>
    <li
      v-for="(task, index) of tasks"
      :key="index"
      :class="{ del: task.completed }"
    >
      <input
        type="checkbox"
        :checked="task.completed"
        @change="handleComplete(index, $event)"
      />
      {{ task.title }}
      <button @click="handleRemove(index, task)">x</button>
    </li>
  </ul>
  <p>
    {{ remaining }} item{{ remaining !== 1 ? 's' : '' }} left /
    {{ tasks.length }} item{{ tasks.length !== 1 ? 's' : '' }} in total
  </p>
  <div style="display: flex; gap: 8px">
    <input
      type="text"
      v-model="value"
      @keydown.enter="handleAdd"
      placeholder="What need to be done?"
    />
    <button @click.passive="handleAdd">Add</button>
    <button @click="handleClearComplete">Clear completed</button>
    <button @click="handleClearAll">Clear all</button>
  </div>
</template>

<style>
.del {
  text-decoration: line-through;
}
</style>
