<script vapor>
import { ref, shallowRef } from 'vue'
const show = ref(true)
const toggle = ref(true)
const count = ref(0)

import VaporCompA from './components/VaporCompA.vue'
import VaporCompB from './components/VaporCompB.vue'
const activeComponent = shallowRef(VaporCompB)
function toggleComponent() {
  activeComponent.value =
    activeComponent.value === VaporCompA ? VaporCompB : VaporCompA
}
</script>

<template>
  <div class="vshow">
    <button @click="show = !show">Show</button>
    <Transition>
      <h1 v-show="show">vShow</h1>
    </Transition>
  </div>
  <div class="vif">
    <button @click="toggle = !toggle">Toggle</button>
    <Transition appear>
      <h1 v-if="toggle">vIf</h1>
    </Transition>
  </div>
  <div class="keyed">
    <button @click="count++">inc</button>
    <Transition>
      <h1 style="position: absolute" :key="count">{{ count }}</h1>
    </Transition>
  </div>
  <div class="out-in">
    <button @click="toggleComponent">toggle out-in</button>
    <div>
      <Transition name="fade" mode="out-in">
        <component :is="activeComponent"></component>
      </Transition>
    </div>
  </div>
  <div class="in-out">
    <button @click="toggleComponent">toggle in-out</button>
    <div>
      <Transition name="fade" mode="in-out">
        <component :is="activeComponent"></component>
      </Transition>
    </div>
  </div>
</template>
<style>
.keyed {
  height: 100px;
}
</style>
