<script setup vapor lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <div class="test">{{ text }}</div>
</template>
