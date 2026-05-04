<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <h1 style="position: absolute">{{ text }}</h1>
</template>
