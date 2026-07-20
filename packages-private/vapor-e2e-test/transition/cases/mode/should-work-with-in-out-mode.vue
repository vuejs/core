<script setup vapor>
import { shallowRef } from 'vue'
import VaporCompA from '../../components/VaporCompA.vue'
import VaporCompB from '../../components/VaporCompB.vue'

const activeComponent = shallowRef(VaporCompB)
function toggleComponent() {
  activeComponent.value =
    activeComponent.value === VaporCompA ? VaporCompB : VaporCompA
}
</script>

<template>
  <div class="in-out">
    <button @click="toggleComponent">toggle in-out</button>
    <div>
      <Transition name="fade" mode="in-out">
        <component :is="activeComponent"></component>
      </Transition>
    </div>
  </div>
</template>
