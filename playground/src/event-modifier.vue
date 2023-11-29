<script setup lang="ts">
const handleClick = () => {
  console.log('Hello, Vapor!')
}

// @ts-expect-error
globalThis.handleClick = handleClick
</script>

<template>
  <form>
    <button @click="handleClick">submit</button>
  </form>

  <form>
    <button @click.prevent="handleClick">no submit</button>
  </form>
</template>
