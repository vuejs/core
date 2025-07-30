<script setup vapor lang="ts">
import { ref } from 'vue'
import VdomComp from './VdomComp.vue'

defineProps<{
  msg: string
}>()

const ok = ref(true)
const passSlot = ref(true)
const slotProp = ref('slot prop')
</script>

<template>
  <div class="vapor" style="border: 2px solid red; padding: 10px">
    <h2>This is a Vapor component in VDOM</h2>
    <p class="vapor-prop">props.msg: {{ msg }}</p>

    <button @click="ok = !ok">Toggle slots</button>

    <div v-if="ok" style="border: 2px solid orange; padding: 10px">
      <h3>vdom slots in vapor component</h3>
      <button
        class="change-vdom-slot-in-vapor-prop"
        @click="slotProp = 'changed'"
      >
        change slot prop
      </button>
      <div class="vdom-slot-in-vapor-default">
        #default:
        <slot :foo="slotProp" />
      </div>
      <div class="vdom-slot-in-vapor-test">
        #test: <slot name="test">fallback content</slot>
      </div>
    </div>

    <button
      class="toggle-vapor-slot-in-vdom-default"
      @click="passSlot = !passSlot"
    >
      Toggle default slot to vdom
    </button>
    <VdomComp :msg="msg">
      <template #default="{ foo }" v-if="passSlot">
        <div>slot prop: {{ foo }}</div>
        <div>component prop: {{ msg }}</div>
      </template>
    </VdomComp>
  </div>
</template>
