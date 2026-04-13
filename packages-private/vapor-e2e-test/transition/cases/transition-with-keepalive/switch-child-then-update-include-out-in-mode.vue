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

const CompA = defineVaporComponent({
  name: 'CompA',
  setup() {
    return template('<div>CompA</div>')()
  },
})

const CompB = defineVaporComponent({
  name: 'CompB',
  setup() {
    return template('<div>CompB</div>')()
  },
})

const CompC = defineVaporComponent({
  name: 'CompC',
  setup() {
    onUnmounted(() => {
      calls.push('CompC unmounted')
    })
    return template('<div>CompC</div>')()
  },
})

const includeToChange = ref(['CompA', 'CompB', 'CompC'])
const currentView = shallowRef(CompA)
const switchToB = () => (currentView.value = CompB)
const switchToC = () => (currentView.value = CompC)
const switchToA = () => {
  currentView.value = CompA
  includeToChange.value = ['CompA']
}
</script>

<template>
  <div class="keep-alive-update-include">
    <div>
      <transition mode="out-in">
        <KeepAlive :include="includeToChange">
          <component :is="currentView" />
        </KeepAlive>
      </transition>
    </div>
    <button id="switchToB" @click="switchToB">switchToB</button>
    <button id="switchToC" @click="switchToC">switchToC</button>
    <button id="switchToA" @click="switchToA">switchToA</button>
  </div>
</template>
