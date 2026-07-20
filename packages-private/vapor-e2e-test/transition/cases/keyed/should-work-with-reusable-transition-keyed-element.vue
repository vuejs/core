<script setup vapor>
import {
  createComponent,
  defineVaporComponent,
  ref,
  VaporTransition,
} from 'vue'

const count = ref(0)
const MyTransition = defineVaporComponent((props, { slots }) => {
  return createComponent(VaporTransition, { name: () => 'test' }, slots)
})
</script>

<template>
  <div class="reusable-keyed">
    <button @click="count++">inc</button>
    <MyTransition>
      <h1 style="position: absolute" :key="count">{{ count }}</h1>
    </MyTransition>
  </div>
</template>
