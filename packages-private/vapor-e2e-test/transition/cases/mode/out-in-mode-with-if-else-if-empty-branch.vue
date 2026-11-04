<script setup vapor>
import { ref } from 'vue'

const n = ref(1)

function addN() {
  n.value = (n.value + 1) % 3
}
</script>

<template>
  <div class="out-in-if-else-if-empty">
    <button @click="addN">addN - {{ n }}</button>
    <div>
      <Transition mode="out-in">
        <div v-if="n == 0">text1</div>
        <div v-else-if="n == 1">text2</div>
      </Transition>
    </div>
  </div>
</template>
