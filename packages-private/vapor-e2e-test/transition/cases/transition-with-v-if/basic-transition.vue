<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
</script>

<template>
  <div class="if-basic">
    <div>
      <transition>
        <div v-if="toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">basic toggle</button>
  </div>
</template>
