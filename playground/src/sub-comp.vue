<script setup lang="ts">
import {
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  useAttrs,
  watchEffect,
} from 'vue/vapor'

const props = defineProps<{
  foo: string
  bar: string
  baz: string
}>()

const attrs = useAttrs()

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
  <h2>sub-comp</h2>
  <p>
    props: {{ props }}
    <br />
    attrs: {{ attrs }}
    <br />
    keys(attrs): {{ keys(attrs) }}
  </p>
</template>
