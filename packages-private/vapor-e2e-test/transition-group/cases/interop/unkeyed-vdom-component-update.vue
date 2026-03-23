<script setup vapor>
import { ref } from 'vue'
import VdomComp from '../../components/VdomComp.vue'

const show = ref(false)
const update = () => (show.value = true)
</script>

<template>
  <div class="unkeyed-vdom-component-update">
    <button @click="update">update button</button>
    <div>
      <transition-group name="test">
        <VdomComp>
          <div>a</div>
        </VdomComp>
        <div v-if="show" key="b" class="test">b</div>
      </transition-group>
    </div>
  </div>
</template>
