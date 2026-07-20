<script setup vapor>
import { ref } from 'vue'

const show = ref(false)
const toggle = () => (show.value = true)
</script>

<template>
  <div class="static-keyed-enter">
    <button @click="toggle">toggle button</button>
    <div>
      <transition-group name="test">
        <div v-if="show" key="a" class="test">a</div>
        <div v-if="show" key="b" class="test">b</div>
      </transition-group>
    </div>
  </div>
</template>
