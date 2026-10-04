<script setup lang="ts">
import { ref } from 'vue'
import VaporExpandingItem from '../../transition-group/components/VaporExpandingItem.vue'

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
  <div class="trans-group-vapor-component-move">
    <button @click="toggleExpansion">toggle expansion of first element</button>
    <div>
      <transition-group name="group" tag="div" class="item-wrapper">
        <VaporExpandingItem
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

.group-move,
.group-enter-active,
.group-leave-active {
  transition: all 50ms cubic-bezier(0.55, 0, 0.1, 1);
}

.group-leave-active {
  position: absolute;
}
</style>
