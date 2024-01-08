<script setup lang="ts">
import { ref } from 'vue/vapor'
const handleClick = () => {
  console.log('Hello, Vapor!')
}

const i = ref(0)
const event = ref('click')
</script>

<template>
  <form>
    <button @click="handleClick">submit</button>
  </form>

  <form>
    <button @click.prevent="handleClick">no submit</button>
  </form>

  <div>
    {{ i }}
    <button @[event].prevent="i++">Add by {{ event }}</button>
    <button @click="event = event === 'click' ? 'contextmenu' : 'click'">
      Change Event
    </button>
  </div>
</template>
