<script setup vapor>
import { ref } from 'vue'

const toggle = ref(true)
const name = ref('test')
</script>

<template>
  <div class="if-dynamic-name">
    <div>
      <transition :name="name">
        <div v-if="toggle" class="test">content</div>
      </transition>
    </div>
    <button class="toggle" @click="toggle = !toggle">button</button>
    <button class="change" @click="name = 'changed'">{{ name }}</button>
  </div>
</template>
