<script setup lang="ts">
import { computed, ref } from '@vue/vapor'

const count = ref(1)
const obj = computed(() => ({ id: String(count.value), subObj: { a: 'xxx' } }))
const key = ref('id')

const handleClick = () => {
  count.value++
}
</script>

<template>
  <button @click="handleClick">{{ count }}</button>

  <!-- prop id's value should update reactively  -->
  <button :id="'before'" :[key]="'dynamic key after' + count">
    {{ count }}
  </button>
  <!-- prop id's value should update only once  -->
  <button :[key]="'dynamic key before' + count" :id="'before'">
    {{ count }}
  </button>
  <!-- object props should update reactively -->
  <button v-bind="obj">{{ count }}</button>
  <button v-bind="{ id: `${count}`, subObj: { a: 'xxx' } }">
    {{ count }}
  </button>
  <!-- prop id's value should update reactively since it was override by object props -->
  <button :id="'before'" v-bind="obj">{{ count }}</button>
  <button :[key]="'dynamic key before'" v-bind="obj">
    {{ count }}
  </button>
  <!-- prop id's value should update only once since the prop id in object props was override -->
  <button v-bind="obj" :id="'after'">{{ count }}</button>
  <button v-bind="obj" :[key]="'dynamic key after'">{{ count }}</button>
</template>
