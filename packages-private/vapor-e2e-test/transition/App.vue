<script vapor>
import { ref, shallowRef } from 'vue'
const show = ref(true)
const toggle = ref(true)
const count = ref(0)

const calls = []
window.calls = calls

import VaporCompA from './components/VaporCompA.vue'
import VaporCompB from './components/VaporCompB.vue'
const activeComponent = shallowRef(VaporCompB)
function toggleComponent() {
  activeComponent.value =
    activeComponent.value === VaporCompA ? VaporCompB : VaporCompA
}

const toggleVdom = ref(true)
import VDomComp from './components/VdomComp.vue'

const interopComponent = shallowRef(VDomComp)
function toggleInteropComponent() {
  interopComponent.value =
    interopComponent.value === VaporCompA ? VDomComp : VaporCompA
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
    <Transition
      appear
      @beforeEnter="() => calls.push('beforeEnter')"
      @enter="() => calls.push('onEnter')"
      @afterEnter="() => calls.push('afterEnter')"
      @beforeLeave="() => calls.push('beforeLeave')"
      @leave="() => calls.push('onLeave')"
      @afterLeave="() => calls.push('afterLeave')"
      @beforeAppear="() => calls.push('beforeAppear')"
      @appear="() => calls.push('onAppear')"
      @afterAppear="() => calls.push('afterAppear')"
    >
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
  <div class="vdom">
    <button @click="toggleVdom = !toggleVdom">toggle vdom component</button>
    <div>
      <Transition>
        <VDomComp v-if="toggleVdom" />
      </Transition>
    </div>
  </div>
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
<style>
.keyed {
  height: 100px;
}
</style>
