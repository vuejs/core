<script setup vapor>
import { ref } from 'vue'
import StaticKeyItem from '../../components/StaticKeyItem.vue'

const show = ref(false)
const toggle = () => (show.value = true)
</script>

<template>
  <div class="static-keyed-component-enter">
    <button @click="toggle">toggle button</button>
    <div>
      <transition-group name="test">
        <StaticKeyItem v-if="show" key="a" text="a" />
        <StaticKeyItem v-if="show" key="b" text="b" />
      </transition-group>
    </div>
  </div>
</template>
