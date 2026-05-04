<script setup vapor>
import { ref } from 'vue'
import VdomKeyItem from '../../components/VdomKeyItem.vue'

const show = ref(false)
const toggle = () => (show.value = true)
</script>

<template>
  <div class="static-keyed-vdom-component-enter">
    <button @click="toggle">toggle button</button>
    <div>
      <transition-group name="test">
        <VdomKeyItem v-if="show" key="a" text="a" />
        <VdomKeyItem v-if="show" key="b" text="b" />
      </transition-group>
    </div>
  </div>
</template>
