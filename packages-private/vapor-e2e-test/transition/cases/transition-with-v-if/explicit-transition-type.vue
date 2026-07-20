<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
</script>

<template>
  <div class="if-ani-explicit-type">
    <div>
      <transition name="test-anim-long" type="animation">
        <div v-if="toggle">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
