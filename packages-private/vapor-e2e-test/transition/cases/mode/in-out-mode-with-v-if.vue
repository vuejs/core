<script setup vapor>
import { ref } from 'vue'

const n = ref(1)

function addN() {
  n.value = (n.value + 1) % 2
}
</script>

<template>
  <div class="in-out-if">
    <button @click="addN">addN</button>
    <div>
      <Transition mode="in-out">
        <div v-if="n">text1</div>
      </Transition>
    </div>
  </div>
</template>
