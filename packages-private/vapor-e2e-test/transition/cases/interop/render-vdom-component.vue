<script setup vapor>
import { ref } from 'vue'
import VDomComp from '../../components/VdomComp.vue'

const toggleVdom = ref(true)
</script>

<template>
  <div class="vdom">
    <button @click="toggleVdom = !toggleVdom">toggle vdom component</button>
    <div>
      <Transition>
        <VDomComp v-if="toggleVdom" />
      </Transition>
    </div>
  </div>
</template>
