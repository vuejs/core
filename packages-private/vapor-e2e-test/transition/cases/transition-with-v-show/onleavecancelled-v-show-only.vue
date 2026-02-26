<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
const calls = []
window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)
</script>

<template>
  <div class="show-leave-cancelled">
    <div>
      <transition
        name="test"
        @leave-cancelled="() => calls.push('leaveCancelled')"
      >
        <div v-show="toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">leave cancelled</button>
  </div>
</template>
