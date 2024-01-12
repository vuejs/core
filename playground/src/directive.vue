<script setup lang="ts">
import { ObjectDirective, FunctionDirective, ref } from '@vue/vapor'

const text = ref('created (overwrite by v-text), ')
const counter = ref(0)
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
  beforeUpdate(node, binding) {
    console.log('beforeUpdate', binding, node)
  },
  updated(node, binding) {
    console.log('updated', binding, node)
  },
}
const vDirectiveSimple: FunctionDirective<HTMLDivElement> = (node, binding) => {
  console.log('v-directive-simple:', node, binding)
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
  <button @click="counter++">
    {{ counter }} (Click to Update Other Element)
  </button>
</template>

<style>
html {
  color-scheme: dark;
  background-color: #000;
  padding: 10px;
}
</style>
