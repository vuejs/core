<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
const duration = window.__TRANSITION_DURATION__ || 50
</script>

<template>
  <div class="duration-leave">
    <div>
      <transition name="test" :duration="{ leave: duration * 2 }">
        <div v-if="toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
