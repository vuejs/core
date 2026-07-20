<script setup vapor>
import { defineVaporAsyncComponent, ref } from 'vue'
import VaporCompA from '../../components/VaporCompA.vue'

const toggle = ref(true)
const AsyncComp = defineVaporAsyncComponent(() => {
  return new Promise(resolve => setTimeout(() => resolve(VaporCompA), 50))
})
</script>

<template>
  <div class="async">
    <div id="container">
      <transition>
        <AsyncComp v-if="!toggle"></AsyncComp>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
