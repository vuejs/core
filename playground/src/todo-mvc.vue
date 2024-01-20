<script setup lang="ts">
import { onMounted, ref } from 'vue/vapor'

interface Task {
  title: string
  completed: boolean
}
const tasks = ref<Task[]>([])
const value = ref('hello')
const inputRef = ref<HTMLInputElement>()

function handleAdd() {
  tasks.value.push({
    title: value.value,
    completed: false,
  })
  // TODO: clear input
  value.value = ''
}

onMounted(() => {
  console.log('onMounted')
  console.log(inputRef.value)
})
</script>

<template>
  <ul>
    <!-- TODO: v-for -->
    <li>
      <!-- TODO checked=false -->
      <input type="checkbox" :checked="tasks[0]?.completed" />
      {{ tasks[0]?.title }}
    </li>
    <li>
      <input type="checkbox" :checked="tasks[1]?.completed" />
      {{ tasks[1]?.title }}
    </li>
    <li>
      <input type="checkbox" :checked="tasks[2]?.completed" />
      {{ tasks[2]?.title }}
    </li>
    <li>
      <input type="checkbox" :checked="tasks[3]?.completed" />
      {{ tasks[3]?.title }}
    </li>
    <li>
      <input
        type="text"
        :ref="el => (inputRef = el)"
        :value="value"
        @input="evt => (value = evt.target.value)"
      />
      <button @click="handleAdd">Add</button>
    </li>
  </ul>
</template>
