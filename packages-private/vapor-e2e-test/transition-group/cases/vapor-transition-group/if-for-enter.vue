<script setup vapor>
import { ref } from 'vue'

const show = ref(false)
const list = ref([0, 1])
</script>

<template>
  <div class="if-for-enter">
    <button class="toggle" @click="show = !show">toggle button</button>
    <button class="add" @click="list.push(list.length)">add button</button>
    <div>
      <transition-group tag="ul">
        <li v-if="show" v-for="value in list" :key="value" class="test">
          {{ value }}
        </li>
      </transition-group>
    </div>
  </div>
</template>
