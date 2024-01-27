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

function handleAdd() {
  tasks.value.push({
    title: value.value,
    completed: false,
  })
  // TODO: clear input
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

function handleRemove(idx: number) {
  tasks.value.splice(idx, 1)
}
</script>

<template>
  <h1>todos</h1>
  <ul>
    <!-- TODO: v-for -->
    <li v-if="tasks[0]" :class="{ del: tasks[0]?.completed }">
      <input
        type="checkbox"
        :checked="tasks[0]?.completed"
        @change="handleComplete(0, $event)"
      />
      {{ tasks[0]?.title }}
      <button @click="handleRemove(0)">x</button>
    </li>
    <li v-if="tasks[1]" :class="{ del: tasks[1]?.completed }">
      <input
        type="checkbox"
        :checked="tasks[1]?.completed"
        @change="handleComplete(1, $event)"
      />
      {{ tasks[1]?.title }}
      <button @click="handleRemove(1)">x</button>
    </li>
    <li v-if="tasks[2]" :class="{ del: tasks[2]?.completed }">
      <input
        type="checkbox"
        :checked="tasks[2]?.completed"
        @change="handleComplete(2, $event)"
      />
      {{ tasks[2]?.title }}
      <button @click="handleRemove(2)">x</button>
    </li>
    <li v-if="tasks[3]" :class="{ del: tasks[3]?.completed }">
      <input
        type="checkbox"
        :checked="tasks[3]?.completed"
        @change="handleComplete(3, $event)"
      />
      {{ tasks[3]?.title }}
      <button @click="handleRemove(3)">x</button>
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
    <button @click="handleAdd">Add</button>
    <button @click="handleClearComplete">Clear completed</button>
    <button @click="handleClearAll">Clear all</button>
  </div>
</template>

<style>
.del {
  text-decoration: line-through;
}
</style>
