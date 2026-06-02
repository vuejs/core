<script setup vapor>
import { ref } from 'vue'

const items = ref(['a', 'b', 'c'])
const showB = ref(false)
const showHiddenItem = () => {
  showB.value = true
  items.value = ['c', 'a', 'b', 'd']
}
</script>

<template>
  <div class="v-show-enter-does-not-also-run-move-transition">
    <button @click="showHiddenItem">show hidden item</button>
    <div>
      <transition-group name="group" tag="div" class="show-group">
        <div
          v-for="item in items"
          :key="item"
          v-show="item === 'b' ? showB : true"
          class="test show-item"
        >
          {{ item }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style>
.show-group {
  display: flex;
  gap: 5px;
}

.show-item {
  width: 100px;
  height: 20px;
}
</style>
