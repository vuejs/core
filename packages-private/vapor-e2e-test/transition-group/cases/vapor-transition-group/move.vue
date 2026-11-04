<script setup vapor>
import { ref } from 'vue'

const items = ref(['a', 'b', 'c'])
const moveClick = () => (items.value = ['d', 'b', 'a'])
</script>

<template>
  <div class="move">
    <button @click="moveClick">move button</button>
    <div>
      <transition-group name="group">
        <div v-for="item in items" :key="item" class="test">{{ item }}</div>
      </transition-group>
    </div>
  </div>
</template>
