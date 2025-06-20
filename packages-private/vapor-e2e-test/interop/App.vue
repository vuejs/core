<script setup lang="ts">
import { ref } from 'vue'
import VaporComp from './VaporComp.vue'
import SimpleVaporComp from './components/SimpleVaporComp.vue'

const msg = ref('hello')
const passSlot = ref(true)

;(window as any).calls = []
;(window as any).getCalls = () => {
  const ret = (window as any).calls.slice()
  ;(window as any).calls = []
  return ret
}

const show = ref(true)
const toggle = ref(true)
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

  <!-- keepalive -->
  <div class="render-vapor-component">
    <button class="btn-show" @click="show = !show">show</button>
    <button class="btn-toggle" @click="toggle = !toggle">toggle</button>
    <div>
      <KeepAlive v-if="show">
        <SimpleVaporComp v-if="toggle" />
      </KeepAlive>
    </div>
  </div>
  <!-- keepalive end -->
</template>
