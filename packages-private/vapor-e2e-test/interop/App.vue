<script setup lang="ts">
import { ref, defineVaporAsyncComponent, h } from 'vue'
import VaporComp from './components/VaporComp.vue'
import VdomFoo from './components/VdomFoo.vue'

const msg = ref('hello')
const passSlot = ref(true)

const duration = typeof process !== undefined && process.env.CI ? 200 : 50

const AsyncVDomFoo = defineVaporAsyncComponent({
  loader: () => {
    return new Promise(r => {
      setTimeout(() => {
        r(VdomFoo as any)
      }, duration)
    })
  },
  loadingComponent: () => h('span', 'loading...'),
})
</script>

<template>
  <input v-model="msg" />
  <button class="toggle-vdom-slot-in-vapor" @click="passSlot = !passSlot">
    toggle #test slot
  </button>
  <VaporComp :msg="msg">
    <template #default="{ foo }">
      <div>slot prop: {{ foo }}</div>
      <div>component prop: {{ msg }}</div>
    </template>

    <template #test v-if="passSlot">A test slot</template>
  </VaporComp>

  <!-- async component  -->
  <div class="async-component-interop">
    <div class="with-vdom-component">
      <AsyncVDomFoo />
    </div>
  </div>
  <!-- async component end -->
</template>
