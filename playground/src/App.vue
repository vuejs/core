<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div>
    <h1 class="red">Hello world</h1>
    <!-- {{ count }} -->
    <button style="font-weight: bold">Inc</button>
  </div>
</template>

<style>
.red {
  color: red;
}
</style>
