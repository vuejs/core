<script setup vapor>
import { ref } from 'vue'

const items = ref(['a', 'b', 'c'])
const enterClick = () => items.value.push('d', 'e')
</script>

<template>
  <div class="enter">
    <button @click="enterClick">enter button</button>
    <div>
      <transition-group name="test">
        <div v-for="item in items" :key="item" class="test">{{ item }}</div>
      </transition-group>
    </div>
  </div>
</template>
