<script setup vapor>
import { defineVaporAsyncComponent, ref } from 'vue'
import RootSlot from '../../components/RootSlot.vue'

const AsyncRootSlot = defineVaporAsyncComponent(() => Promise.resolve(RootSlot))
const items = ref(['a', 'b', 'c'])
const moveClick = () => (items.value = ['d', 'b', 'a'])
</script>

<template>
  <div class="async-root-slot-component-move">
    <button @click="moveClick">async root slot button</button>
    <div>
      <transition-group name="group">
        <AsyncRootSlot key="async-root-slot">
          <div v-for="item in items" :key="item" class="test">{{ item }}</div>
        </AsyncRootSlot>
      </transition-group>
    </div>
  </div>
</template>
