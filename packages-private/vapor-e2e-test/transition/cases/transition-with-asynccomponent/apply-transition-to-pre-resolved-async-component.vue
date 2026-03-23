<script setup vapor>
import { defineVaporAsyncComponent, ref } from 'vue'
import VaporCompA from '../../components/VaporCompA.vue'

const toggle = ref(true)

const AsyncCompResolved = defineVaporAsyncComponent(() =>
  Promise.resolve(VaporCompA),
)
</script>

<template>
  <div class="async-resolved">
    <div id="hidden-async">
      <AsyncCompResolved v-show="false" />
    </div>
    <div id="container">
      <transition>
        <AsyncCompResolved v-if="!toggle"></AsyncCompResolved>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
