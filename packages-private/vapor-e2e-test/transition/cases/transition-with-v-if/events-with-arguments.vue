<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
const calls = []
const timeout = (fn, time) => setTimeout(fn, time)

window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)
</script>

<template>
  <div class="if-events-with-args">
    <div>
      <transition
        :css="false"
        name="test"
        @before-enter="
          el => {
            calls.push('beforeEnter')
            el.classList.add('before-enter')
          }
        "
        @enter="
          (el, done) => {
            calls.push('onEnter')
            el.classList.add('enter')
            timeout(done, 200)
          }
        "
        @after-enter="
          el => {
            calls.push('afterEnter')
            el.classList.add('after-enter')
          }
        "
        @before-leave="
          el => {
            calls.push('beforeLeave')
            el.classList.add('before-leave')
          }
        "
        @leave="
          (el, done) => {
            calls.push('onLeave')
            el.classList.add('leave')
            timeout(done, 200)
          }
        "
        @after-leave="
          () => {
            calls.push('afterLeave')
          }
        "
      >
        <div v-if="toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
