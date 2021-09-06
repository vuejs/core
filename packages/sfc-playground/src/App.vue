<script setup lang="ts">
import Header from './Header.vue'
import { Repl, ReplStore } from '@vue/repl'
import { watchEffect } from 'vue'

document.documentElement.style.setProperty('--vh', window.innerHeight + `px`)

const store = new ReplStore({
  serializedState: location.hash.slice(1),
  defaultVueRuntimeURL: import.meta.env.PROD
    ? `${location.origin}/vue.runtime.esm-browser.js`
    : `${location.origin}/src/vue-dev-proxy`
})

// persist state
watchEffect(() => history.replaceState({}, '', store.serialize()))
</script>

<template>
  <Header :store="store" />
  <Repl :store="store" :showCompileOutput="true" />
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
