<script setup lang="ts">
import { ref } from '@vue/vapor'

const visible = ref(true)
function handleClick() {
  visible.value = !visible.value
}
</script>

<template>
  <button @click="handleClick">toggle</button>
  <h1 v-show="visible">hello world</h1>
</template>
