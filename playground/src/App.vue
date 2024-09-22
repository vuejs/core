<script setup lang="ts" vapor>
import {
  ref,
  computed,
  onMounted,
  onBeforeMount,
  getCurrentInstance,
  onBeforeUpdate,
  onUpdated,
  onRenderTracked,
  onRenderTriggered,
} from 'vue/vapor'

const instance = getCurrentInstance()!
const count = ref(1)
const double = computed(() => count.value * 2)
const html = computed(() => `<button>HTML! ${count.value}</button>`)

const inc = () => count.value++
const dec = () => count.value--

onBeforeMount(() => {
  console.log('onBeforeMount', instance.isMounted)
})
onMounted(() => {
  console.log('onMounted', instance.isMounted)
})
onMounted(() => {
  setTimeout(() => {
    count.value++
  }, 1000)
})

onBeforeUpdate(() => {
  console.log('before updated')
})
onUpdated(() => {
  console.log('updated')
})

onRenderTracked(e => {
  console.log(`Render Tracked:`, e.target)
})
onRenderTriggered(e => {
  console.log(`Render trigger:`, e.target)
})

const log = (arg: any) => {
  console.log('callback in render effect')
  return arg
}
</script>

<template>
  <div>
    <h1 class="red">Counter</h1>
    <div>The number is {{ log(count) }}.</div>
    <div>{{ count }} * 2 = {{ double }}</div>
    <div style="display: flex; gap: 8px">
      <button @click="inc">inc</button>
      <button @click="dec">dec</button>
    </div>
    <div v-html="html" />
    <div v-text="html" />
    <div v-once>once: {{ count }}</div>
    <div v-pre>{{ count }}</div>
    <div v-cloak>{{ count }}</div>
  </div>
</template>

<style>
.red {
  color: red;
}

html {
  padding: 10px;
}
</style>
