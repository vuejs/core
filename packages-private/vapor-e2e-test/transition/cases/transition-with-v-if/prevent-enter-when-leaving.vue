<script setup vapor>
import { defineVaporComponent, ref } from 'vue'

const calls = []
window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)

const preventEnterToggle = ref(false)
const preventEnterVisible = ref(true)

const togglePreventEnter = () => {
  preventEnterToggle.value = !preventEnterToggle.value
  if (preventEnterToggle.value) {
    preventEnterVisible.value = true
  }
}

const PreventEnterComp = defineVaporComponent({
  setup() {
    preventEnterVisible.value = false
    return []
  },
})
</script>

<template>
  <div class="if-prevent-enter-when-leaving">
    <div class="content" v-if="preventEnterToggle">
      <div class="container">
        <transition
          appear
          @before-enter="() => calls.push('beforeEnter')"
          @enter="() => calls.push('enter')"
          @enter-cancelled="() => calls.push('enterCancelled')"
          @after-enter="() => calls.push('afterEnter')"
          @before-leave="() => calls.push('beforeLeave')"
          @leave="() => calls.push('leave')"
          @after-leave="() => calls.push('afterLeave')"
        >
          <div v-if="preventEnterVisible">content</div>
        </transition>
      </div>
      <PreventEnterComp />
    </div>
    <button @click="togglePreventEnter">button</button>
  </div>
</template>
