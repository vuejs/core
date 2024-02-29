<script setup lang="ts">
import { ref } from 'vue/vapor'
const arr = ref([1, 2, 3])
const obj = ref<Record<string, any>>({ a: 1, b: 2, c: 3 })
const str = ref('123')
const map = ref(
  new Map([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ]),
)
const num = ref(10)
const objChange = () => {
  obj.value = { a: 'x', e: 4, f: 5, g: 6 }
}
const arrChange = () => {
  arr.value = [4, 5, 6, 7]
}
</script>

<template>
  <button @click="arrChange">change arr</button>
  <button @click="objChange">change obj</button>

  <div>arr:</div>
  <div v-for="(item, index) in arr" :key="item">{{ item }}-{{ index }}</div>

  <hr />

  <div>obj:</div>
  <div v-for="(item, index) in obj">{{ item }}-{{ index }}</div>

  <hr />

  <div>map:</div>
  <div v-for="(item, index) in map" :key="item[0]">{{ item }}-{{ index }}</div>

  <hr />

  <div>str:</div>
  <div v-for="(item, index) in str" :key="item">{{ item }}-{{ index }}</div>

  <hr />

  <div>num:</div>
  <div v-for="(item, index) in num" :key="item">{{ item }}-{{ index }}</div>
</template>
