<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
const calls = []
window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)
</script>

<template>
  <div class="show-appear">
    <div>
      <transition
        name="test"
        appear
        appear-from-class="test-appear-from"
        appear-to-class="test-appear-to"
        appear-active-class="test-appear-active"
        @beforeEnter="() => calls.push('beforeEnter')"
        @enter="() => calls.push('onEnter')"
        @afterEnter="() => calls.push('afterEnter')"
      >
        <div v-show="toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
