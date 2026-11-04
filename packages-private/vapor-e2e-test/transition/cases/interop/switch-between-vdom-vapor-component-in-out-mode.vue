<script setup vapor>
import { ref } from 'vue'
import VaporCompA from '../../components/VaporCompA.vue'
import VDomComp from '../../components/VdomComp.vue'

const toggleVdom = ref(true)
</script>

<template>
  <div class="vdom-vapor-in-out">
    <button @click="toggleVdom = !toggleVdom">
      switch between vdom/vapor component in-out mode
    </button>
    <div>
      <Transition name="fade" mode="in-out">
        <VaporCompA v-if="toggleVdom" />
        <VDomComp v-else></VDomComp>
      </Transition>
    </div>
  </div>
</template>
