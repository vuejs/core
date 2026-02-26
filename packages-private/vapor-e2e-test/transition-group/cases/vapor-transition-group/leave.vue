<script setup vapor>
import { ref } from 'vue'

const items = ref(['a', 'b', 'c'])
const leaveClick = () => (items.value = ['b'])
</script>

<template>
  <div class="leave">
    <button @click="leaveClick">leave button</button>
    <div>
      <transition-group name="test" move-class="noop-move">
        <div v-for="item in items" :key="item" class="test">{{ item }}</div>
      </transition-group>
    </div>
  </div>
</template>
