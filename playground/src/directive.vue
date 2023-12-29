<script setup lang="ts">
import { ObjectDirective, FunctionDirective, ref } from '@vue/vapor'

const text = ref('created (overwrite by v-text), ')
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
  },
}
const vDirectiveSimple: FunctionDirective<HTMLDivElement> = (node, binding) => {
  console.log(node, binding)
}
const handleClick = () => {
  text.value = 'change'
}
</script>

<template>
  <div
    v-directive:foo.bar="text"
    v-text="text"
    v-directive-simple="text"
    @click="handleClick"
  />
</template>
