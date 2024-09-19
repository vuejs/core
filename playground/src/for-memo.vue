<script setup lang="ts">
import { reactive, ref } from 'vue'

const arr = reactive(['foo', 'bar', 'baz', 'qux'])
const selected = ref('foo')
</script>

<template>
  <div
    v-for="item of arr"
    v-memo="[selected === item]"
    :class="{ danger: selected === item }"
    @click="selected = item"
  >
    {{ item }}
  </div>
</template>

<style>
.danger {
  color: red;
}
</style>
