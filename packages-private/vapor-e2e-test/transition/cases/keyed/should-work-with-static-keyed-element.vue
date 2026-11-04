<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
</script>

<template>
  <div class="static-keyed">
    <button @click="toggle = !toggle">toggle</button>
    <Transition>
      <h1 v-if="toggle" key="a" style="position: absolute">0</h1>
      <h1 v-else key="b" style="position: absolute">1</h1>
    </Transition>
  </div>
</template>
