<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  msg: string
}>()

const bar = ref('slot prop')
</script>

<template>
  <div class="vdom" style="border: 2px solid blue; padding: 10px">
    <h2>This is a VDOM component in Vapor</h2>
    <p class="vdom-prop">props.msg: {{ msg }}</p>
    <div style="border: 2px solid aquamarine; padding: 10px">
      <h3>vapor slots in vdom</h3>
      <button class="change-vapor-slot-in-vdom-prop" @click="bar = 'changed'">
        Change slot prop
      </button>
      <div class="vapor-slot-in-vdom-default">
        #default: <slot :foo="bar">default slot fallback</slot>
      </div>
      <div class="vapor-slot-in-vdom-test">
        #test <slot name="test">fallback</slot>
      </div>
    </div>
  </div>
</template>
