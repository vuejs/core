<script setup vapor>
import { ref } from 'vue'
import VaporExpandingItem from '../../components/VaporExpandingItem.vue'

const items = ref(
  [...Array(2)].map((_, i) => ({
    id: i + 1,
    isOpened: false,
  })),
)

function toggleExpansion() {
  items.value = [
    { id: 1, isOpened: true },
    { id: 2, isOpened: false },
  ]
}
</script>

<template>
  <div class="same-key-component-move-after-prop-change">
    <button @click="toggleExpansion">toggle expansion of first element</button>
    <div>
      <transition-group name="group" tag="div" class="item-wrapper">
        <VaporExpandingItem
          v-for="i in items"
          :key="i.id"
          :id="i.id"
          :is-opened="i.isOpened"
        />
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

.same-key-component-move-after-prop-change .group-move {
  transition: transform 300ms ease;
}
</style>
