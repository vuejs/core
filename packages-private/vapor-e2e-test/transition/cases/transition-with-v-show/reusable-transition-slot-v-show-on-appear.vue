<script setup vapor>
import {
  createComponent,
  defineVaporComponent,
  ref,
  VaporTransition,
} from 'vue'

const shown = ref(true)
const hidden = ref(false)
const calls = []
window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)

const MyTransition = defineVaporComponent((props, { slots }) => {
  return createComponent(
    VaporTransition,
    {
      name: () => 'test',
      appear: () => true,
      appearFromClass: () => 'test-appear-from',
      appearToClass: () => 'test-appear-to',
      appearActiveClass: () => 'test-appear-active',
      onBeforeEnter: () => () => calls.push('beforeEnter'),
      onEnter: () => () => calls.push('onEnter'),
      onAfterEnter: () => () => calls.push('afterEnter'),
    },
    slots,
  )
})
</script>

<template>
  <div class="show-appear-reusable-slot">
    <div>
      <MyTransition>
        <div v-show="shown" class="test">content</div>
      </MyTransition>
    </div>
    <button @click="shown = !shown">button</button>
  </div>

  <div class="show-appear-not-enter-reusable-slot">
    <div>
      <MyTransition>
        <div v-show="hidden" class="test">content</div>
      </MyTransition>
    </div>
    <button @click="hidden = !hidden">button</button>
  </div>
</template>
