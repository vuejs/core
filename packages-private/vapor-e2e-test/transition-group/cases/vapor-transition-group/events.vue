<script setup vapor>
import { ref } from 'vue'

const items = ref(['a', 'b', 'c'])
const eventsClick = () => (items.value = ['b', 'c', 'd'])

const appear = ref(false)
window.setAppear = () => (appear.value = true)

let calls = []
window.getCalls = () => {
  const ret = calls.slice()
  calls = []
  return ret
}
</script>

<template>
  <div class="events">
    <button @click="eventsClick">events button</button>
    <div v-if="appear">
      <transition-group
        name="test"
        move-class="noop-move"
        appear
        appear-from-class="test-appear-from"
        appear-to-class="test-appear-to"
        appear-active-class="test-appear-active"
        @beforeEnter="() => calls.push('beforeEnter')"
        @enter="() => calls.push('onEnter')"
        @afterEnter="() => calls.push('afterEnter')"
        @beforeLeave="() => calls.push('beforeLeave')"
        @leave="() => calls.push('onLeave')"
        @afterLeave="() => calls.push('afterLeave')"
        @beforeAppear="() => calls.push('beforeAppear')"
        @appear="() => calls.push('onAppear')"
        @afterAppear="() => calls.push('afterAppear')"
      >
        <div v-for="item in items" :key="item" class="test">{{ item }}</div>
      </transition-group>
    </div>
  </div>
</template>
