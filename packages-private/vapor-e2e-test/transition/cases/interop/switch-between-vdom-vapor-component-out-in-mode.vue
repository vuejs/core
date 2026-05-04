<script setup vapor>
import { shallowRef } from 'vue'
import VaporCompA from '../../components/VaporCompA.vue'
import VDomComp from '../../components/VdomComp.vue'

const interopComponent = shallowRef(VDomComp)
function toggleInteropComponent() {
  interopComponent.value =
    interopComponent.value === VaporCompA ? VDomComp : VaporCompA
}
</script>

<template>
  <div class="vdom-vapor-out-in">
    <button @click="toggleInteropComponent">
      switch between vdom/vapor component out-in mode
    </button>
    <div>
      <Transition name="fade" mode="out-in">
        <component :is="interopComponent"></component>
      </Transition>
    </div>
  </div>
</template>
