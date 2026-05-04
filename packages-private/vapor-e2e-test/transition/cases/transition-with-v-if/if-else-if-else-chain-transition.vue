<script setup vapor>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="if-else-chain">
    <div>
      <transition>
        <div v-if="count === 0" class="test">0</div>
        <div v-else-if="count === 1" class="test">1</div>
        <div v-else class="test">2</div>
      </transition>
    </div>
    <button @click="count++">inc</button>
  </div>
</template>
