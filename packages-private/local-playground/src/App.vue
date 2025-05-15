<script setup lang="ts">
import { ref } from 'vue'
import VaporComp from './VaporComp.vue'

const msg = ref('hello')
const passSlot = ref(true)
</script>

<template>
  <input v-model="msg" />
  <button @click="passSlot = !passSlot">toggle #test slot</button>
  <VaporComp :msg="msg">
    <template #default="{ foo }">
      <div>slot props: {{ foo }}</div>
      <div>component prop: {{ msg }}</div>
    </template>

    <template #test v-if="passSlot"> A test slot </template>
  </VaporComp>
</template>
