<script setup lang="ts">
import {
  computed,
  onMounted,
  provide,
  reactive,
  ref,
  toRefs,
  watch,
  watchEffect,
} from 'vue'
import BaseInput from './BaseInput.vue'
import Card from './Card.vue'
import TodoItem, { type Todo } from './TodoItem.vue'
import { themeKey } from './keys'

const filters = ['all', 'active', 'done'] as const
type Filter = (typeof filters)[number]

const todos = ref<Todo[]>([])
const newTodo = ref('')
const filter = ref<Filter>('all')
const settings = reactive({ theme: 'light' as 'light' | 'dark' })
const { theme } = toRefs(settings)
let uid = 0

provide(themeKey, theme)

const filtered = computed(() =>
  filter.value === 'all'
    ? todos.value
    : todos.value.filter(t => (filter.value === 'done') === t.done),
)
const remaining = computed(() => todos.value.filter(t => !t.done).length)

function add() {
  const text = newTodo.value.trim()
  if (!text) return
  todos.value.push({ id: uid++, text, done: false })
  newTodo.value = ''
}

function remove(todo: Todo) {
  todos.value.splice(todos.value.indexOf(todo), 1)
}

watchEffect(() => {
  document.title = `Todos (${remaining.value})`
})

watch(todos, value => localStorage.setItem('todos', JSON.stringify(value)), {
  deep: true,
})

onMounted(() => {
  todos.value = JSON.parse(localStorage.getItem('todos') || '[]')
  uid = todos.value.length
})
</script>

<template>
  <Card title="Todos" :class="theme">
    <template #header="{ title }">
      <h1 :class="{ empty: !todos.length }">{{ title }}</h1>
      <button @click="theme = theme === 'light' ? 'dark' : 'light'">
        Toggle theme
      </button>
    </template>

    <form @submit.prevent="add">
      <BaseInput v-model="newTodo" placeholder="What needs to be done?" />
      <button :disabled="!newTodo">Add</button>
    </form>

    <select v-model="filter">
      <option v-for="f in filters" :key="f" :value="f">{{ f }}</option>
    </select>

    <ul v-if="filtered.length">
      <TodoItem
        v-for="todo in filtered"
        :key="todo.id"
        :todo="todo"
        @remove="remove(todo)"
      />
    </ul>
    <p v-else>Nothing to do</p>

    <template #footer>
      <span v-show="todos.length">
        {{ remaining }} item{{ remaining === 1 ? '' : 's' }} left
      </span>
    </template>
  </Card>
</template>
