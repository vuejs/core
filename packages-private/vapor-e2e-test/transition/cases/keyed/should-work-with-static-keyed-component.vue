<script setup vapor>
import { ref } from 'vue'
import StaticKeyItem from '../../components/StaticKeyItem.vue'

const toggle = ref(true)
</script>

<template>
  <div class="static-keyed-component">
    <button @click="toggle = !toggle">toggle</button>
    <Transition>
      <StaticKeyItem v-if="toggle" key="a" text="0" />
      <StaticKeyItem v-else key="b" text="1" />
    </Transition>
  </div>
</template>
