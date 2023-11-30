<script setup lang="ts">
const handleClick = () => {
  console.log('Hello, Vapor!')
}
</script>

<template>
  <form>
    <button @click="handleClick">submit</button>
  </form>

  <form>
    <button @click.prevent="handleClick">no submit</button>
  </form>
</template>
