<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
const duration = 50
</script>

<template>
  <div class="duration-single-value">
    <div>
      <transition name="test" :duration="duration * 2">
        <div v-if="toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
