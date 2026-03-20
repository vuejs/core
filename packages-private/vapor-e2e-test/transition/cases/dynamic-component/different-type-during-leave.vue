<script setup vapor lang="ts">
import { computed, ref } from 'vue'

const tags = ['div', 'span', 'p']
const view = ref(0)
const calls: string[] = []
const wait = (fn: () => void, time: number) => setTimeout(fn, time)

const advanceView = () => {
  view.value = (view.value + 1) % tags.length
}

const currentTag = computed(() => tags[view.value])

;(window as any).getCalls = () => [...calls]
;(window as any).resetCalls = () => {
  calls.length = 0
}

const record = (phase: string, el: Element) => {
  calls.push(`${phase}:${el.tagName.toLowerCase()}`)
}
</script>

<template>
  <div class="different-type-during-leave">
    <button @click="advanceView">toggle</button>
    <div>
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
        <component :is="currentTag">content</component>
      </transition>
    </div>
  </div>
</template>
