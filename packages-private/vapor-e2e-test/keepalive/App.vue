<script vapor>
import { ref } from 'vue'
import VdomComp from './components/VdomComp.vue';

window.calls = []
window.getCalls = () => {
  const ret = window.calls.slice()
  window.calls = []
  return ret
}

const show = ref(true)
const toggle = ref(true)
</script>

<template>
  <div class="render-vdom-component">
    <button class="btn-show" @click="show = !show">show</button>
    <button class="btn-toggle" @click="toggle = !toggle">toggle</button>
    <div>
      <KeepAlive v-if="show">
        <VdomComp v-if="toggle"></VdomComp>
      </KeepAlive>
    </div>
  </div>
</template>
