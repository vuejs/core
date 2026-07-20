<script setup vapor>
import { ref } from 'vue'

const items = ref(['a', 'b', 'c'])
const name = ref('invalid')

const dynamicClick = () => (items.value = ['b', 'c', 'a'])
const changeName = () => {
  name.value = 'group'
  items.value = ['a', 'b', 'c']
}
</script>

<template>
  <div class="dynamic-name">
    <button class="toggleBtn" @click="dynamicClick">dynamic button</button>
    <button class="changeNameBtn" @click="changeName">change name</button>
    <div>
      <transition-group :name="name">
        <div v-for="item in items" :key="item">{{ item }}</div>
      </transition-group>
    </div>
  </div>
</template>
