<script setup vapor>
import { ref } from 'vue'

const items = ref(['a', 'b', 'c'])
const enterClick = () => items.value.push('d', 'e')
const appear = ref(false)
window.setAppear = () => (appear.value = true)
</script>

<template>
  <div class="appear">
    <button @click="enterClick">appear button</button>
    <div v-if="appear">
      <transition-group
        appear
        appear-from-class="test-appear-from"
        appear-to-class="test-appear-to"
        appear-active-class="test-appear-active"
        name="test"
      >
        <div v-for="item in items" :key="item" class="test">{{ item }}</div>
      </transition-group>
    </div>
  </div>
</template>
