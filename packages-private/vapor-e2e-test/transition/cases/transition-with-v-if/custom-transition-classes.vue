<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
</script>

<template>
  <div class="if-custom-classes">
    <div>
      <transition
        enter-from-class="hello-from"
        enter-active-class="hello-active"
        enter-to-class="hello-to"
        leave-from-class="bye-from"
        leave-active-class="bye-active"
        leave-to-class="bye-to"
      >
        <div v-if="toggle" class="test">content</div>
      </transition>
    </div>
    <button @click="toggle = !toggle">button</button>
  </div>
</template>
