<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import VaporComp from './components/VaporComp.vue'
import VaporCompA from '../transition/components/VaporCompA.vue'
import VdomComp from '../transition/components/VdomComp.vue'
import VaporSlot from '../transition/components/VaporSlot.vue'

const msg = ref('hello')
const passSlot = ref(true)

const toggleVapor = ref(true)
const interopComponent = shallowRef(VdomComp)
function toggleInteropComponent() {
  interopComponent.value =
    interopComponent.value === VaporCompA ? VdomComp : VaporCompA
}

const items = ref(['a', 'b', 'c'])
const enterClick = () => items.value.push('d', 'e')
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
  <!-- transition interop -->
  <div>
    <div class="trans-vapor">
      <button @click="toggleVapor = !toggleVapor">
        toggle vapor component
      </button>
      <div>
        <Transition>
          <VaporCompA v-if="toggleVapor" />
        </Transition>
      </div>
    </div>
    <div class="trans-vdom-vapor-out-in">
      <button @click="toggleInteropComponent">
        switch between vdom/vapor component out-in mode
      </button>
      <div>
        <Transition name="fade" mode="out-in">
          <component :is="interopComponent"></component>
        </Transition>
      </div>
    </div>
  </div>
  <!-- transition-group interop -->
  <div>
    <div class="trans-group-vapor">
      <button @click="enterClick">insert items</button>
      <div>
        <transition-group name="test">
          <VaporSlot v-for="item in items" :key="item">
            <div>{{ item }}</div>
          </VaporSlot>
        </transition-group>
      </div>
    </div>
  </div>
</template>
