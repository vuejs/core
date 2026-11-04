<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
</script>

<template>
  <div class="svg">
    <svg id="container">
      <transition name="test">
        <circle v-if="toggle" cx="0" cy="0" r="10" class="test"></circle>
      </transition>
    </svg>
    <button id="toggleBtn" @click="toggle = !toggle">button</button>
  </div>
</template>
