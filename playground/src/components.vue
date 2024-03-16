<script setup lang="ts">
import {
  onBeforeMount,
  onMounted,
  onBeforeUnmount,
  onUnmounted,
  ref,
} from 'vue/vapor'
import SubComp from './sub-comp.vue'

const bar = ref('update')
const id = ref('id')
const p = ref<any>({
  bar,
  id: 'not id',
  test: 100,
})

function update() {
  bar.value = 'updated'
  p.value.foo = 'updated foo'
  p.value.newAttr = 'new attr'
  id.value = 'updated id'
}

function update2() {
  delete p.value.test
}

onBeforeMount(() => console.log('root: before mount'))
onMounted(() => console.log('root: mounted'))
onBeforeUnmount(() => console.log('root: before unmount'))
onUnmounted(() => console.log('root: unmounted'))
</script>

<template>
  <div>
    root comp
    <button @click="update">update</button>
    <button @click="update2">update2</button>
    <SubComp foo="foo" v-bind="p" :baz="'baz'" :id />
  </div>
</template>
