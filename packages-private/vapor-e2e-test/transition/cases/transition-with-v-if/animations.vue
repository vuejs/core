<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
</script>

<template>
  <div class="if-ani">
    <div>
      <transition name="test-anim">
        <div v-if="toggle">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
