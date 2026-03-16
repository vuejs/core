<script setup vapor>
import { ref } from 'vue'

const show = ref(false)
const list = ref([0, 1])
</script>

<template>
  <div class="for-if-enter">
    <button class="toggle" @click="show = !show">toggle button</button>
    <button class="add" @click="list.push(list.length)">add button</button>
    <div>
      <transition-group tag="ul">
        <template v-for="value in list">
          <li v-if="show" :key="value" class="test">
            {{ value }}
          </li>
        </template>
      </transition-group>
    </div>
  </div>
</template>
