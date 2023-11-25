<script setup lang="ts">
import { ref, computed } from 'vue'

const count = ref(0)
const double = computed(() => count.value * 2)

const increment = () => count.value++

const html = '<b>HTML</b>'
</script>

<template>
  <h1 id="title">Counter</h1>
  <p>Count: {{ count }}</p>
  <p>Double: {{ double }}</p>
  <button @click="increment">Increment</button>
  <div v-html="html" />
  <input type="text" />
  <p v-once>once: {{ count }}</p>
  <p v-pre>{{ count }}</p>
</template>
