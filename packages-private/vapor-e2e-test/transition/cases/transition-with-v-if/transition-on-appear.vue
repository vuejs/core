<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
</script>

<template>
  <div class="if-appear">
    <div>
      <transition
        name="test"
        appear
        appear-from-class="test-appear-from"
        appear-to-class="test-appear-to"
        appear-active-class="test-appear-active"
      >
        <div v-if="toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
