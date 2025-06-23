<script setup vapor>
import { ref, Teleport } from 'vue'
import VdomComp from './components/VdomComp.vue'
const disabled = ref(true)
</script>

<template>
  <div class="target"></div>
  <div class="interop-render-vdom-comp">
    <button @click="disabled = !disabled">toggle</button>
    <div>
      <Teleport to=".target" defer :disabled>
        <VdomComp />
      </Teleport>
    </div>
  </div>
</template>
