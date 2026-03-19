<script setup vapor>
import { ref } from 'vue'

const tags = ['div', 'section', undefined]
const tagIndex = ref(0)
const tag = ref(tags[tagIndex.value])

const cycleTag = () => {
  tagIndex.value = (tagIndex.value + 1) % tags.length
  tag.value = tags[tagIndex.value]
}
</script>

<template>
  <div class="dynamic-tag">
    <button @click="cycleTag">cycle tag</button>
    <div>
      <transition-group :tag="tag">
        <div v-for="item in ['a', 'b', 'c']" :key="item" class="test">
          {{ item }}
        </div>
      </transition-group>
    </div>
  </div>
</template>
