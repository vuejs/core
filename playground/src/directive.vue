<script setup lang="ts">
import { FunctionDirective } from '@vue/vapor'

const vDirective: FunctionDirective<HTMLDivElement, undefined> = node => {
  node.textContent = 'hello world'
  node.style.color = 'red'
}
</script>

<template>
  <div v-directive />
</template>
