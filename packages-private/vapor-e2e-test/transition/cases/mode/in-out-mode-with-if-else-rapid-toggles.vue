<script setup vapor>
import { ref } from 'vue'

const view = ref(0)

function changeView() {
  view.value = view.value === 1 ? 0 : 1
}
</script>

<template>
  <div class="in-out-if-else-rapid">
    <button @click="changeView">changeView</button>
    <div>
      <Transition mode="in-out">
        <div v-if="view">1</div>
        <div v-else>2</div>
      </Transition>
    </div>
  </div>
</template>
