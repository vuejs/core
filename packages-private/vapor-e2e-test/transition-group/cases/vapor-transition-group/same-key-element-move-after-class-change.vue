<script setup vapor>
import { ref } from 'vue'

const items = ref([
  { id: 1, isOpened: false },
  { id: 2, isOpened: false },
])

function toggleExpansion() {
  items.value[0].isOpened = true
}
</script>

<template>
  <div class="same-key-element-move-after-class-change">
    <button @click="toggleExpansion">toggle expansion of first element</button>
    <div>
      <transition-group name="group" tag="div" class="item-wrapper">
        <div
          v-for="i in items"
          :key="i.id"
          class="item"
          :class="i.isOpened ? 'opened' : 'closed'"
          :id="`item-${i.id}`"
        >
          <div class="item-inner">item {{ i.id }}</div>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style>
.item-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  width: 430px;
}

.same-key-element-move-after-class-change .item {
  border: 1px solid black;
  width: 100px;
  height: 100px;
}

.same-key-element-move-after-class-change .item.opened {
  width: 420px;
}

.same-key-element-move-after-class-change .group-move {
  transition: transform 300ms ease;
}
</style>
