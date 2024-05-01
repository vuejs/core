<script setup lang="ts">
import { ref, getCurrentInstance } from 'vue'

const msg = ref('Hello World!')
// @ts-expect-error
const isVapor = getCurrentInstance().vapor
</script>

<template>
  <h1>{{ msg }}</h1>
  <p>
    VAPOR <b>{{ isVapor ? 'ON' : 'OFF' }}</b>
  </p>
  <input v-model="msg" />
</template>
