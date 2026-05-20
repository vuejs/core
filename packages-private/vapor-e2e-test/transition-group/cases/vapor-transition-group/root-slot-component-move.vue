<script setup vapor>
import { ref } from 'vue'
import RootSlot from '../../components/RootSlot.vue'

const items = ref(['a', 'b', 'c'])
const moveClick = () => (items.value = ['d', 'b', 'a'])
</script>

<template>
  <div class="root-slot-component-move">
    <button @click="moveClick">root slot button</button>
    <div>
      <transition-group name="group">
        <RootSlot>
          <div v-for="item in items" :key="item" class="test">{{ item }}</div>
        </RootSlot>
      </transition-group>
    </div>
  </div>
</template>
