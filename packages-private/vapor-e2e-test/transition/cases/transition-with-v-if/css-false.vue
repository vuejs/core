<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
const calls = []

window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)
</script>

<template>
  <div class="if-css-false">
    <div>
      <transition
        :css="false"
        name="test"
        @beforeEnter="() => calls.push('beforeEnter')"
        @enter="() => calls.push('onEnter')"
        @afterEnter="() => calls.push('afterEnter')"
        @beforeLeave="() => calls.push('beforeLeave')"
        @leave="() => calls.push('onLeave')"
        @afterLeave="() => calls.push('afterLeave')"
      >
        <div v-if="toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle"></button>
  </div>
</template>
