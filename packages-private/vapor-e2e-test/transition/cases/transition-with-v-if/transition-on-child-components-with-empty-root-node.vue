<script setup vapor>
import { createIf, defineVaporComponent, ref, shallowRef, template } from 'vue'

const toggle = ref(true)

const One = defineVaporComponent({
  setup() {
    return createIf(
      () => false,
      () => template('<div>one</div>', true)(),
    )
  },
})

const Two = defineVaporComponent({
  setup() {
    return template('<div>two</div>', true)()
  },
})

const view = shallowRef(One)
function changeView() {
  view.value = view.value === One ? Two : One
}
</script>

<template>
  <div class="if-empty-root">
    <div>
      <transition name="test">
        <component class="test" :is="view"></component>
      </transition>
    </div>
    <button class="toggle" @click="toggle = !toggle">button</button>
    <button class="change" @click="changeView">changeView button</button>
  </div>
</template>
