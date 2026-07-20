<script setup vapor>
import {
  createComponent,
  defineVaporComponent,
  ref,
  VaporTransition,
} from 'vue'

const toggle = ref(true)

const MyTransitionFallthroughAttr = defineVaporComponent((props, { slots }) => {
  return createComponent(
    VaporTransition,
    { foo: () => 1, name: () => 'test' },
    slots,
  )
})
</script>

<template>
  <div class="if-fallthrough-attr">
    <div>
      <MyTransitionFallthroughAttr>
        <div v-if="toggle">content</div>
      </MyTransitionFallthroughAttr>
    </div>
    <button @click="toggle = !toggle">button fallthrough</button>
  </div>
</template>
