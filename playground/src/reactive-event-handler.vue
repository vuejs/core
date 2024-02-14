<script setup lang="ts">
import { ref, watchEffect } from 'vue/vapor'

const count = ref(0)
const inc = () => count.value++
const dec = () => count.value--
const handler = ref(inc)

watchEffect(() => {
  if (count.value > 5) {
    handler.value = dec
  } else if (count.value < -5) {
    handler.value = inc
  }
})
</script>

<template>
  <button @click="handler">{{ count }}</button>
</template>
