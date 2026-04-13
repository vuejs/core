<script setup vapor>
import { defineVaporComponent, onUnmounted, ref, template } from 'vue'

const calls = []
window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)

const toggle = ref(true)

const TrueBranch = defineVaporComponent({
  name: 'TrueBranch',
  setup() {
    onUnmounted(() => {
      calls.push('TrueBranch')
    })
    return template('<div>0</div>')()
  },
})

const includeRef = ref(['TrueBranch'])
const click = () => {
  toggle.value = !toggle.value
  if (toggle.value) {
    includeRef.value = ['TrueBranch']
  } else {
    includeRef.value = []
  }
}
</script>

<template>
  <div class="keep-alive">
    <div>
      <transition mode="out-in">
        <KeepAlive :include="includeRef">
          <TrueBranch v-if="toggle"></TrueBranch>
        </KeepAlive>
      </transition>
    </div>
    <button @click="click">button</button>
  </div>
</template>
