<script setup vapor>
import { ref } from 'vue'
import VdomComp from './components/VdomComp.vue'

const items = ref(['a', 'b', 'c'])
const enterClick = () => items.value.push('d', 'e')
const leaveClick = () => (items.value = ['b'])
const enterLeaveClick = () => (items.value = ['b', 'c', 'd'])
const appear = ref(false)
window.setAppear = () => (appear.value = true)
const moveClick = () => (items.value = ['d', 'b', 'a'])

const name = ref('invalid')
const dynamicClick = () => (items.value = ['b', 'c', 'a'])
const changeName = () => {
  name.value = 'group'
  items.value = ['a', 'b', 'c']
}

let calls = []
window.getCalls = () => {
  const ret = calls.slice()
  calls = []
  return ret
}
const eventsClick = () => (items.value = ['b', 'c', 'd'])

const interopClick = () => (items.value = ['b', 'c', 'd'])
</script>

<template>
  <div class="transition-group-container">
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
      <div v-if="appear">
        <transition-group
          appear
          appear-from-class="test-appear-from"
          appear-to-class="test-appear-to"
          appear-active-class="test-appear-active"
          name="test"
        >
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
    <div class="dynamic-name">
      <button class="toggleBtn" @click="dynamicClick">dynamic button</button>
      <button class="changeNameBtn" @click="changeName">change name</button>
      <div>
        <transition-group :name="name">
          <div v-for="item in items" :key="item">{{ item }}</div>
        </transition-group>
      </div>
    </div>
    <div class="events">
      <button @click="eventsClick">events button</button>
      <div v-if="appear">
        <transition-group
          name="test"
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
    <div class="interop">
      <button @click="interopClick">interop button</button>
      <div>
        <transition-group name="test">
          <VdomComp v-for="item in items" :key="item">
            <div>{{ item }}</div>
          </VdomComp>
        </transition-group>
      </div>
    </div>
  </div>
</template>
<style>
.transition-group-container > div {
  padding: 15px;
  border: 1px solid #f7f7f7;
  margin-top: 15px;
}

.test-move,
.test-enter-active,
.test-leave-active {
  transition: all 50ms cubic-bezier(0.55, 0, 0.1, 1);
}

.test-enter-from,
.test-leave-to {
  opacity: 0;
  transform: scaleY(0.01) translate(30px, 0);
}

.test-leave-active {
  position: absolute;
}
</style>
