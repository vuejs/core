<script vapor lang="ts">
import { ref } from 'vue'
const items = ref(['a', 'b', 'c'])
const enterClick = () => items.value.push('d', 'e')
const leaveClick = () => items.value = ['b']
const enterLeaveClick = () => items.value = ['b', 'c', 'd']
const moveClick = () => items.value = ['d', 'b', 'a']
</script>

<template>
  <div>
    <div class="enter">
      <button @click="enterClick">enter button</button>
      <div>
        <transition-group name="test">
          <div v-for="item in items" :key="item" class="test">{{ item }}</div>
        </transition-group>
      </div>
    </div>
    <div class="leave">
      <button @click="leaveClick">leave button</button>
      <div>
        <transition-group name="test">
          <div v-for="item in items" :key="item" class="test">{{ item }}</div>
        </transition-group>
      </div>
    </div>
    <div class="enter-leave">
      <button @click="enterLeaveClick">enter-leave button</button>
      <div>
        <transition-group name="test">
          <div v-for="item in items" :key="item" class="test">{{ item }}</div>
        </transition-group>
      </div>
    </div>
    <div class="appear">
      <button @click="enterClick">appear button</button>
      <div>
        <transition-group appear appear-from-class="test-appear-from" appear-to-class="test-appear-to"
          appear-active-class="test-appear-active" name="test">
          <div v-for="item in items" :key="item" class="test">{{ item }}</div>
        </transition-group>
      </div>
    </div>
    <div class="move">
      <button @click="moveClick">move button</button>
      <div>
        <transition-group name="group">
          <div v-for="item in items" :key="item" class="test">{{ item }}</div>
        </transition-group>
      </div>
    </div>
  </div>
</template>
