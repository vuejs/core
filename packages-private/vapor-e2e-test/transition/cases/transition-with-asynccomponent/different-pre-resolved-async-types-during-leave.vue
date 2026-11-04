<script setup vapor lang="ts">
import { computed, defineVaporAsyncComponent, ref } from 'vue'
import VaporCompA from '../../components/VaporCompA.vue'
import VaporCompB from '../../components/VaporCompB.vue'

const AsyncCompResolvedA = defineVaporAsyncComponent(() =>
  Promise.resolve(VaporCompA),
)
const AsyncCompResolvedB = defineVaporAsyncComponent(() =>
  Promise.resolve(VaporCompB),
)

const components = [AsyncCompResolvedA, AsyncCompResolvedB]
const view = ref(0)
const calls: string[] = []
const wait = (fn: () => void, time: number) => setTimeout(fn, time)

const advanceView = () => {
  view.value = (view.value + 1) % components.length
}

const currentComponent = computed(() => components[view.value])

;(window as any).getCalls = () => [...calls]
;(window as any).resetCalls = () => {
  calls.length = 0
}

const record = (phase: string, el: Element) => {
  calls.push(`${phase}:${el.textContent?.trim()}`)
}
</script>

<template>
  <div class="different-pre-resolved-async-types-during-leave">
    <div id="hidden-a">
      <AsyncCompResolvedA v-show="false" />
    </div>
    <div id="hidden-b">
      <AsyncCompResolvedB v-show="false" />
    </div>
    <button @click="advanceView">toggle</button>
    <div id="container">
      <transition
        :css="false"
        @before-enter="el => record('beforeEnter', el)"
        @enter="
          (el, done) => {
            record('enter', el)
            wait(done, 50)
          }
        "
        @after-enter="el => record('afterEnter', el)"
        @before-leave="el => record('beforeLeave', el)"
        @leave="
          (el, done) => {
            record('leave', el)
            wait(done, 50)
          }
        "
        @after-leave="el => record('afterLeave', el)"
      >
        <component :is="currentComponent" />
      </transition>
    </div>
  </div>
</template>
