<script setup lang="ts">
import { Data } from '@vue/shared'
import { ref, onMounted } from 'vue/vapor'

const inputRef = ref()
const buttonRef = ref()

function handleSetRef(el: HTMLButtonElement, refs: Data) {
  buttonRef.value = el
  console.log(el, refs)
}

onMounted(() => {
  console.log(inputRef.value, buttonRef.value)
})
</script>

<template>
  <div>
    <input type="text" ref="inputRef" />
    <button :ref="handleSetRef">Button</button>
  </div>
</template>
