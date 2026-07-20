<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
const calls = []

window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)
</script>

<template>
  <div class="if-enter-cancelled">
    <div>
      <transition
        name="test"
        @enter-cancelled="
          () => {
            calls.push('enterCancelled')
          }
        "
      >
        <div v-if="!toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">cancelled</button>
  </div>
</template>
