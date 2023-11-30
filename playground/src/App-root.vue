<script setup lang="ts">
import { ref } from 'vue/vapor'

const count = ref(1)

const handleClick = () => {
  count.value++
}
</script>

<template>
  <button @click="handleClick">
    {{ count }}
  </button>
</template>
