<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
</script>

<template>
  <div class="if-no-trans">
    <div>
      <transition name="noop">
        <div v-if="toggle">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
