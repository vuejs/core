<script setup>
import { ref, getCurrentInstance } from 'vue'

const msg = ref('Hello World!')
const isVapor = getCurrentInstance().vapor
</script>

<template>
  <h1>{{ msg }}</h1>
  <input v-model="msg" />
  <b>VAPOR {{ isVapor ? 'ON' : 'OFF' }}</b>
</template>
