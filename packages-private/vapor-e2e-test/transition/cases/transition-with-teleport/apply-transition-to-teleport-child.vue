<script setup vapor>
import { ref } from 'vue'
import VaporCompB from '../../components/VaporCompB.vue'

const toggle = ref(true)
</script>

<template>
  <div class="with-teleport">
    <div class="target"></div>
    <div class="container">
      <Transition>
        <Teleport to=".target" defer>
          <VaporCompB v-if="!toggle" class="test"></VaporCompB>
        </Teleport>
      </Transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
