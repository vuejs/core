<script setup lang="ts">
import { ref } from 'vue'
import VaporComp from './components/VaporComp.vue'
import SimpleVaporComp from './components/SimpleVaporComp.vue'

const msg = ref('hello')
const passSlot = ref(true)
const disabled = ref(true)
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

  <!-- teleport -->
  <div class="teleport">
    <div class="teleport-target"></div>
    <div class="render-vapor-comp">
      <button @click="disabled = !disabled">toggle</button>
      <Teleport to=".teleport-target" defer :disabled="disabled">
        <SimpleVaporComp />
      </Teleport>
    </div>
  </div>
  <!-- teleport end-->
</template>
