<script setup vapor>
import { ref } from 'vue'
import VdomComp from '../../components/VdomComp.vue'

const items = ref(['a', 'b', 'c'])
const interopClick = () => (items.value = ['b', 'c', 'd'])
</script>

<template>
  <div class="interop">
    <button @click="interopClick">interop button</button>
    <div>
      <transition-group name="test">
        <VdomComp v-for="item in items" :key="item">
          <div>{{ item }}</div>
        </VdomComp>
      </transition-group>
    </div>
  </div>
</template>
