<script setup vapor>
import { ref } from 'vue'
import VdomExpandingItem from '../../components/VdomExpandingItem.vue'

const items = ref(
  [...Array(2)].map((_, i) => ({
    id: i + 1,
    isOpened: false,
  })),
)

function toggleExpansion() {
  items.value[0].isOpened = !items.value[0].isOpened
}
</script>

<template>
  <div class="keyed-vdom-component-move-after-key-change">
    <button @click="toggleExpansion">toggle expansion of first element</button>
    <div>
      <transition-group name="group" tag="div" class="item-wrapper">
        <VdomExpandingItem
          v-for="i in items"
          :key="`${i.id}-${i.isOpened ? 'true' : 'false'}`"
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

.keyed-vdom-component-move-after-key-change .group-move {
  transition: transform 300ms ease;
}
</style>
