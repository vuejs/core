<script setup lang="ts">
import type { Data } from '@vue/runtime-shared'
import { ref, onMounted } from 'vue/vapor'

const inputRef = ref<HTMLInputElement>()
const buttonRef = ref<HTMLButtonElement>()

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
    <!-- @vue-expect-error TODO fix types -->
    <button :ref="handleSetRef">Button</button>
  </div>
</template>
