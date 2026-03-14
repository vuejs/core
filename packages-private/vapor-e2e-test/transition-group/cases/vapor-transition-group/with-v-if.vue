<script setup vapor>
import { ref } from 'vue'
const show = ref(false)
const list = ref([0, 1])
</script>

<template>
  <div class="with-v-if">
    <button @click="show = !show">ToggleShow</button>

    <div>
      <TransitionGroup tag="ul">
        <li v-if="show" v-for="value in list" :key="value">{{ value }}</li>
      </TransitionGroup>
    </div>
  </div>
</template>
