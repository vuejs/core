<script setup lang="ts">
import Header from './Header.vue'
import { Repl, ReplStore, SFCOptions } from '@vue/repl'
import type Monaco from '@vue/repl/monaco-editor'
import type CodeMirror from '@vue/repl/codemirror-editor'
import { ref, watchEffect, onMounted } from 'vue'
import { shallowRef } from 'vue'

const EditorComponent = shallowRef<typeof Monaco | typeof CodeMirror>()

if (import.meta.env.DEV) {
  import('@vue/repl/codemirror-editor').then(
    mod => (EditorComponent.value = mod.default),
  )
} else {
  import('@vue/repl/monaco-editor').then(
    mod => (EditorComponent.value = mod.default),
  )
}

const replRef = ref<InstanceType<typeof Repl>>()

const setVH = () => {
  document.documentElement.style.setProperty('--vh', window.innerHeight + `px`)
}
window.addEventListener('resize', setVH)
setVH()

const useProdMode = ref(false)
const useSSRMode = ref(false)

let hash = location.hash.slice(1)
if (hash.startsWith('__DEV__')) {
  hash = hash.slice(7)
  useProdMode.value = false
}
if (hash.startsWith('__PROD__')) {
  hash = hash.slice(8)
  useProdMode.value = true
}
if (hash.startsWith('__SSR__')) {
  hash = hash.slice(7)
  useSSRMode.value = true
}

const store = new ReplStore({
  serializedState: hash,
  productionMode: useProdMode.value,
  defaultVueRuntimeURL: import.meta.env.PROD
    ? `${location.origin}/vue.runtime.esm-browser.js`
    : `${location.origin}/src/vue-dev-proxy`,
  defaultVueRuntimeProdURL: import.meta.env.PROD
    ? `${location.origin}/vue.runtime.esm-browser.prod.js`
    : `${location.origin}/src/vue-dev-proxy-prod`,
  defaultVueServerRendererURL: import.meta.env.PROD
    ? `${location.origin}/server-renderer.esm-browser.js`
    : `${location.origin}/src/vue-server-renderer-dev-proxy`,
})

// enable experimental features
const sfcOptions: SFCOptions = {
  script: {
    inlineTemplate: useProdMode.value,
    isProd: useProdMode.value,
    propsDestructure: true,
  },
  style: {
    isProd: useProdMode.value,
  },
  template: {
    isProd: useProdMode.value,
    compilerOptions: {
      isCustomElement: (tag: string) => tag === 'mjx-container',
    },
  },
}

// persist state
watchEffect(() => {
  const newHash = store
    .serialize()
    .replace(/^#/, useSSRMode.value ? `#__SSR__` : `#`)
    .replace(/^#/, useProdMode.value ? `#__PROD__` : `#`)
  history.replaceState({}, '', newHash)
})

function toggleProdMode() {
  const isProd = (useProdMode.value = !useProdMode.value)
  sfcOptions.script!.inlineTemplate =
    sfcOptions.script!.isProd =
    sfcOptions.template!.isProd =
    sfcOptions.style!.isProd =
      isProd
  store.toggleProduction()
  store.setFiles(store.getFiles())
}

function toggleSSR() {
  useSSRMode.value = !useSSRMode.value
  store.setFiles(store.getFiles())
}

function reloadPage() {
  replRef.value?.reload()
}

const theme = ref<'dark' | 'light'>('dark')
function toggleTheme(isDark: boolean) {
  theme.value = isDark ? 'dark' : 'light'
}
onMounted(() => {
  const cls = document.documentElement.classList
  toggleTheme(cls.contains('dark'))
})
</script>

<template>
  <Header
    :store="store"
    :prod="useProdMode"
    :ssr="useSSRMode"
    @toggle-theme="toggleTheme"
    @toggle-prod="toggleProdMode"
    @toggle-ssr="toggleSSR"
    @reload-page="reloadPage"
  />
  <Repl
    v-if="EditorComponent"
    ref="replRef"
    :theme="theme"
    :editor="EditorComponent"
    @keydown.ctrl.s.prevent
    @keydown.meta.s.prevent
    :ssr="useSSRMode"
    :store="store"
    :showCompileOutput="true"
    :autoResize="true"
    :sfcOptions="sfcOptions"
    :clearConsole="false"
  />
</template>

<style>
.dark {
  color-scheme: dark;
}

body {
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  margin: 0;
  --base: #444;
  --nav-height: 50px;
}

.vue-repl {
  height: calc(var(--vh) - var(--nav-height)) !important;
}

button {
  border: none;
  outline: none;
  cursor: pointer;
  margin: 0;
  background-color: transparent;
}
</style>
