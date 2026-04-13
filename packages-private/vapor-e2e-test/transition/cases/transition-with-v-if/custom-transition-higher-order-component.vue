<script setup vapor>
import {
  createComponent,
  defineVaporComponent,
  ref,
  VaporTransition,
} from 'vue'

const toggle = ref(true)

const MyTransition = defineVaporComponent((props, { slots }) => {
  return createComponent(VaporTransition, { name: () => 'test' }, slots)
})
</script>

<template>
  <div class="if-high-order">
    <div>
      <MyTransition>
        <div v-if="toggle" class="test">content</div>
      </MyTransition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
