<script setup lang="ts">
import Header from './Header.vue'
import { Repl, ReplStore } from '@vue/repl'
import { watchEffect, ref, onUnmounted } from 'vue'
import Toast from './Toast/Toast'

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
// persist state
watchEffect(() => history.replaceState({}, '', store.serialize()))

const saveListener = ref()
saveListener.value = document.addEventListener('keydown', async e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        await navigator.clipboard.writeText(location.href)
        Toast.show('URL copied to clipboard')
    }
})

onUnmounted(()=>{
    document.removeEventListener('keydown',saveListener.value)
})

</script>

<template>
  <Header :store="store" />
  <Repl :store="store" :showCompileOutput="true" :autoResize="true" />
</template>

<style>
body {
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
        Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
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