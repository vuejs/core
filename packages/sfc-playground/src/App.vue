<script setup lang="ts">
import Header from './Header.vue'
import { Repl, ReplStore } from '@vue/repl'
import { ref, watchEffect } from 'vue'

const setVH = () => {
  document.documentElement.style.setProperty('--vh', window.innerHeight + `px`)
}
window.addEventListener('resize', setVH)
setVH()

const hash = location.hash.slice(1)
const useDevMode = ref(hash.startsWith('__DEV__'))

const store = new ReplStore({
  serializedState: useDevMode.value ? hash.slice(7) : hash,
  defaultVueRuntimeURL: import.meta.env.PROD
    ? `${location.origin}/vue.runtime.esm-browser.js`
    : `${location.origin}/src/vue-dev-proxy`
})

// enable experimental features
const sfcOptions = {
  script: {
    inlineTemplate: !useDevMode.value,
    reactivityTransform: true
  }
}

// persist state
watchEffect(() => {
  const newHash = store
    .serialize()
    .replace(/^#/, useDevMode.value ? `#__DEV__` : `#`)
  history.replaceState({}, '', newHash)
})

function toggleDevMode() {
  const dev = (useDevMode.value = !useDevMode.value)
  sfcOptions.script.inlineTemplate = !dev
  store.setFiles(store.getFiles())
}
</script>

<template>
  <Header :store="store" :dev="useDevMode" @toggle-dev="toggleDevMode" />
  <Repl
    @keydown.ctrl.s.prevent
    @keydown.meta.s.prevent
    :store="store"
    :showCompileOutput="true"
    :autoResize="true"
    :sfcOptions="sfcOptions"
    :clearConsole="false"
  />
</template>

<style>
body {
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  margin: 0;
  --base: #444;
  --nav-height: 50px;
}

.vue-repl {
  height: calc(var(--vh) - var(--nav-height));
}

button {
  border: none;
  outline: none;
  cursor: pointer;
  margin: 0;
  background-color: transparent;
}
</style>
