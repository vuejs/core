<script setup vapor>
import { ref } from 'vue'
const groups = ref([
  { id: 'a', items: ['a1', 'a2'] },
  { id: 'b', items: ['b1', 'b2'] },
])
const move = () => {
  groups.value = [
    { id: 'b', items: ['b1', 'b2'] },
    { id: 'a', items: ['a2', 'a1'] },
  ]
}
</script>

<template>
  <div>
    <div id="origin">
      <TransitionGroup name="outer-no-move" tag="div">
        <div
          v-for="group in groups"
          :key="group.id"
          :id="group.id"
          class="outer-item"
        >
          <TransitionGroup name="inner" tag="div">
            <div
              v-for="item in group.items"
              :key="item"
              :id="item"
              class="inner-item"
            >
              {{ item }}
            </div>
          </TransitionGroup>
        </div>
      </TransitionGroup>
    </div>
    <button id="move-nested" @click="move">move</button>
  </div>
</template>

<style>
.inner-item {
  height: 30px;
}
.outer-move,
.inner-move {
  transition: transform 300ms ease;
}
</style>
