<script setup vapor>
import { ref } from 'vue'
import MyTransitionGroup from '../../components/MyTransitionGroup.vue'

const items = ref(['a', 'b', 'c'])
const moveClick = () => (items.value = ['d', 'b', 'a'])
</script>

<template>
  <div class="reusable-transition-group">
    <button @click="moveClick">reusable button</button>
    <div>
      <MyTransitionGroup name="group">
        <div v-for="item in items" :key="item" class="test">{{ item }}</div>
      </MyTransitionGroup>
    </div>
  </div>
</template>
