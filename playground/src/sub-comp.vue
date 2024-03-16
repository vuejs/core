<script setup lang="ts">
import {
  getCurrentInstance,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  watchEffect,
} from 'vue/vapor'

const props = defineProps<{
  foo: string
  bar: string
  baz: string
}>()

const attrs = getCurrentInstance()?.attrs

watchEffect(() => {
  console.log({ ...attrs })
})

const keys = Object.keys

onBeforeMount(() => console.log('sub: before mount'))
onMounted(() => console.log('sub: mounted'))
onBeforeUnmount(() => console.log('sub: before unmount'))
onUnmounted(() => console.log('sub: unmounted'))
</script>

<template>
  <div>sub-comp</div>
  {{ props }}
  {{ attrs }}
  {{ keys(attrs) }}
</template>
