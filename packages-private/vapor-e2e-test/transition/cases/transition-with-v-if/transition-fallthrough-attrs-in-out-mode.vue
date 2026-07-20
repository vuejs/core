<script setup vapor>
import { defineVaporComponent, ref, shallowRef, template } from 'vue'

const calls = []
window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)

const Two = defineVaporComponent({
  setup() {
    return template('<div>two</div>', true)()
  },
})

const SimpleOne = defineVaporComponent({
  setup() {
    return template('<div>one</div>', true)()
  },
})

const viewInOut = shallowRef(SimpleOne)
function changeViewInOut() {
  viewInOut.value = viewInOut.value === SimpleOne ? Two : SimpleOne
}
</script>

<template>
  <div class="if-fallthrough-attr-in-out">
    <div>
      <transition
        foo="1"
        name="test"
        mode="in-out"
        @beforeEnter="() => calls.push('beforeEnter')"
        @enter="() => calls.push('onEnter')"
        @afterEnter="() => calls.push('afterEnter')"
        @beforeLeave="() => calls.push('beforeLeave')"
        @leave="() => calls.push('onLeave')"
        @afterLeave="() => calls.push('afterLeave')"
      >
        <component :is="viewInOut"></component>
      </transition>
    </div>
    <button @click="changeViewInOut">button</button>
  </div>
</template>
