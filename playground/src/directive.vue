<script setup lang="ts">
import { ObjectDirective } from '@vue/vapor'

const text = 'created (overwrite by v-text), '
const vDirective: ObjectDirective<HTMLDivElement, undefined> = {
  created(node) {
    if (!node.parentElement) {
      node.textContent += 'created, '
      node.style.color = 'red'
    } else {
      alert('!')
    }
  },
  beforeMount(node) {
    if (!node.parentElement) node.textContent += 'beforeMount, '
  },
  mounted(node) {
    if (node.parentElement) node.textContent += 'mounted, '
  }
}
</script>

<template>
  <div v-directive:foo.bar="text" v-text="text" />
</template>
