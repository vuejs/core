<script setup lang="ts">
import Header from './Header.vue'
import { Repl, ReplStore } from '@vue/repl'
import { watchEffect, ref } from 'vue'

const setVH = () => {
  document.documentElement.style.setProperty('--vh', window.innerHeight + `px`)
}
window.addEventListener('resize', setVH)
setVH()

const store = new ReplStore({
  serializedState: location.hash.slice(1),
  defaultVueRuntimeURL: import.meta.env.PROD
    ? `${location.origin}/vue.runtime.esm-browser.js`
    : `${location.origin}/src/vue-dev-proxy`
})

// enable experimental features
const sfcOptions = {
  script: {
    reactivityTransform: true
  }
}

const autoUrl = ref(true);

// persist state
watchEffect(() => autoUrl.value && history.replaceState({}, '', store.serialize()))
</script>

<template>
  <Header :store="store" v-model:auto-url="autoUrl" />
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
