<script setup vapor>
import { ref } from 'vue'
import VdomKeyItem from '../../components/VdomKeyItem.vue'

const toggle = ref(true)
</script>

<template>
  <div class="static-keyed-vdom">
    <button @click="toggle = !toggle">toggle</button>
    <div>
      <Transition>
        <VdomKeyItem v-if="toggle" key="a" text="0" />
        <VdomKeyItem v-else key="b" text="1" />
      </Transition>
    </div>
  </div>
</template>
