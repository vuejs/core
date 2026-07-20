<script setup vapor lang="ts">
import { ref } from 'vue'

const tags = ['div', 'section', undefined]
const tagIndex = ref(0)
const tag = ref(tags[tagIndex.value])
const items = ref(['a', 'b'])

const cycleTag = () => {
  tagIndex.value = (tagIndex.value + 1) % tags.length
  tag.value = tags[tagIndex.value]
}

const addItem = () => {
  items.value = [...items.value, String.fromCharCode(97 + items.value.length)]
}

const renderCalls: string[] = []
;(window as any).getRenderCalls = () => [...renderCalls]
;(window as any).clearRenderCalls = () => {
  renderCalls.length = 0
}

const trackRender = (item: string) => {
  renderCalls.push(item)
  return item
}
</script>

<template>
  <div class="dynamic-tag-render-effect-leak">
    <button class="cycle" @click="cycleTag">cycle tag</button>
    <button class="add" @click="addItem">add item</button>
    <div>
      <transition-group :tag="tag">
        <div v-for="item in items" :key="item" class="test">
          {{ trackRender(item) }}
        </div>
      </transition-group>
    </div>
  </div>
</template>
