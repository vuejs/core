<script setup lang="ts">
import { ref } from 'vue/vapor'

const count = ref(1)

const handleClick = () => {
  count.value++
}

// @ts-expect-error
globalThis.count = count
// @ts-expect-error
globalThis.handleClick = handleClick
</script>

<template>
  <button @click="handleClick">
    {{ count }}
  </button>
</template>
