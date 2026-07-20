<script setup vapor lang="ts">
import { ref } from 'vue'
import VdomCommentToggle from '../../components/VdomCommentToggle.vue'

const items = ref<string[]>([])
const show = ref(false)

const click = () => {
  items.value = ['a', 'b', 'c']
  setTimeout(() => {
    show.value = true
  }, 100)
}
</script>

<template>
  <div class="avoid-set-transition-hooks-for-comment-node">
    <button @click="click">button</button>
    <div>
      <transition-group name="test">
        <div v-for="item in items" :key="item" class="test">{{ item }}</div>
        <VdomCommentToggle key="child" :show="show" />
      </transition-group>
    </div>
  </div>
</template>
