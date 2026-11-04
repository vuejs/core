<script setup vapor>
import { ref } from 'vue'

const items = ref(['a', 'b', 'c'])
const enterLeaveClick = () => (items.value = ['b', 'c', 'd'])
</script>

<template>
  <div class="enter-leave">
    <button @click="enterLeaveClick">enter-leave button</button>
    <div>
      <transition-group name="test" move-class="noop-move">
        <div v-for="item in items" :key="item" class="test">{{ item }}</div>
      </transition-group>
    </div>
  </div>
</template>
