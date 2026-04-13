<script setup vapor>
import {
  defineVaporComponent,
  onUnmounted,
  ref,
  shallowRef,
  template,
} from 'vue'

const calls = []
window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)

const CompA2 = defineVaporComponent({
  name: 'CompA2',
  setup() {
    return template('<div>CompA2</div>')()
  },
})

const CompB2 = defineVaporComponent({
  name: 'CompB2',
  setup() {
    onUnmounted(() => {
      calls.push('CompB2 unmounted')
    })
    return template('<div>CompB2</div>')()
  },
})

const includeRef2 = ref(['CompA2'])
const currentView2 = shallowRef(CompA2)
const switchToB2 = () => {
  currentView2.value = CompB2
  includeRef2.value = ['CompA2', 'CompB2']
}
const switchToA2 = () => {
  currentView2.value = CompA2
  includeRef2.value = ['CompA2']
}
</script>

<template>
  <div class="keep-alive-switch-then-update-include">
    <div>
      <transition name="test-anim" mode="out-in">
        <KeepAlive :include="includeRef2">
          <component :is="currentView2" />
        </KeepAlive>
      </transition>
    </div>
    <button id="switchToA" @click="switchToA2">switchToA</button>
    <button id="switchToB" @click="switchToB2">switchToB</button>
  </div>
</template>
