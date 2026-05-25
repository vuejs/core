<script setup vapor lang="ts">
defineProps<{
  id: number
  isOpened: boolean
}>()
</script>

<template>
  <div class="item" :class="isOpened ? 'opened' : 'closed'" :id="`item-${id}`">
    <div class="item-inner">item {{ id }}</div>
  </div>
</template>

<style>
.item {
  border: 1px solid black;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item.opened {
  width: 420px;
}
</style>
