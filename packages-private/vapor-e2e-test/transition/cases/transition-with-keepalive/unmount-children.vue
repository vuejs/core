<script setup vapor>
import { defineVaporComponent, onUnmounted, ref, template } from 'vue'

const calls = []
window.getCalls = () => calls
window.resetCalls = () => calls.splice(0, calls.length)

const UnmountBranch = defineVaporComponent({
  name: 'UnmountBranch',
  setup() {
    onUnmounted(() => {
      calls.push('UnmountBranch')
    })
    return template('<div>0</div>')()
  },
})

const keepAliveUnmountRef = ref(null)
window.getKeepAliveUnmountStorageContainer = () =>
  keepAliveUnmountRef.value.getStorageContainer()

const unmountIncludeRef = ref(['UnmountBranch'])
const unmountToggle = ref(true)
const unmountClick = () => {
  unmountToggle.value = !unmountToggle.value
  if (unmountToggle.value) {
    unmountIncludeRef.value = ['UnmountBranch']
  } else {
    unmountIncludeRef.value = []
  }
}
</script>

<template>
  <div class="keep-alive-unmount-children">
    <div id="container">
      <transition>
        <KeepAlive ref="keepAliveUnmountRef" :include="unmountIncludeRef">
          <UnmountBranch v-if="unmountToggle"></UnmountBranch>
        </KeepAlive>
      </transition>
    </div>
    <button id="toggleBtn" @click="unmountClick">button</button>
  </div>
</template>
