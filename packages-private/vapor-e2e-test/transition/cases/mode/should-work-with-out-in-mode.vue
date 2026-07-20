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
  <div class="out-in">
    <button @click="toggleComponent">toggle out-in</button>
    <div>
      <Transition name="fade" mode="out-in">
        <component :is="activeComponent"></component>
      </Transition>
    </div>
  </div>
</template>
