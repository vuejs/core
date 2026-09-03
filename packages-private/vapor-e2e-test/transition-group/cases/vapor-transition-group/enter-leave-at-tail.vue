<script setup vapor>
import { ref } from 'vue'

const items = ref(['a', 'b', 'c'])
const click = () => (items.value = ['a', 'b', 'd'])
</script>

<template>
  <div class="enter-leave-at-tail">
    <button @click="click">enter-leave-at-tail button</button>
    <div>
      <transition-group name="test" move-class="noop-move">
        <div v-for="item in items" :key="item" class="test">{{ item }}</div>
      </transition-group>
    </div>
  </div>
</template>
