<script setup vapor>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="keyed">
    <button @click="count++">inc</button>
    <Transition>
      <h1 style="position: absolute" :key="count">{{ count }}</h1>
    </Transition>
  </div>
</template>
