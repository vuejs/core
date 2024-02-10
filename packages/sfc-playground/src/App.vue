<script setup lang="ts">
import Header from './Header.vue'
import { Repl, useStore, SFCOptions, useVueImportMap } from '@vue/repl'
import Monaco from '@vue/repl/monaco-editor'
import { ref, watchEffect, onMounted, computed } from 'vue'

const replRef = ref<InstanceType<typeof Repl>>()

const setVH = () => {
  document.documentElement.style.setProperty('--vh', window.innerHeight + `px`)
}
window.addEventListener('resize', setVH)
setVH()

const useSSRMode = ref(false)

const { productionMode, vueVersion, importMap } = useVueImportMap({
  runtimeDev: import.meta.env.PROD
    ? `${location.origin}/vue.runtime.esm-browser.js`
    : `${location.origin}/src/vue-dev-proxy`,
  runtimeProd: import.meta.env.PROD
    ? `${location.origin}/vue.runtime.esm-browser.prod.js`
    : `${location.origin}/src/vue-dev-proxy-prod`,
  serverRenderer: import.meta.env.PROD
    ? `${location.origin}/server-renderer.esm-browser.js`
    : `${location.origin}/src/vue-server-renderer-dev-proxy`,
})

let hash = location.hash.slice(1)
if (hash.startsWith('__DEV__')) {
  hash = hash.slice(7)
  productionMode.value = false
}
if (hash.startsWith('__PROD__')) {
  hash = hash.slice(8)
  productionMode.value = true
}
if (hash.startsWith('__SSR__')) {
  hash = hash.slice(7)
  useSSRMode.value = true
}

// enable experimental features
const sfcOptions = computed(
  (): SFCOptions => ({
    script: {
      inlineTemplate: productionMode.value,
      isProd: productionMode.value,
      propsDestructure: true,
    },
    style: {
      isProd: productionMode.value,
    },
    template: {
      isProd: productionMode.value,
      compilerOptions: {
        isCustomElement: (tag: string) => tag === 'mjx-container',
      },
    },
  }),
)

const store = useStore(
  {
    builtinImportMap: importMap,
    vueVersion,
    sfcOptions,
  },
  hash,
)
// @ts-expect-error
globalThis.store = store

// persist state
watchEffect(() => {
  const newHash = store
    .serialize()
    .replace(/^#/, useSSRMode.value ? `#__SSR__` : `#`)
    .replace(/^#/, productionMode.value ? `#__PROD__` : `#`)
  history.replaceState({}, '', newHash)
})

function toggleProdMode() {
  productionMode.value = !productionMode.value
}

function toggleSSR() {
  useSSRMode.value = !useSSRMode.value
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

  // @ts-expect-error process shim for old versions of @vue/compiler-sfc dependency
  window.process = { env: {} }
})
</script>

<template>
  <Header
    :store="store"
    :prod="productionMode"
    :ssr="useSSRMode"
    @toggle-theme="toggleTheme"
    @toggle-prod="toggleProdMode"
    @toggle-ssr="toggleSSR"
    @reload-page="reloadPage"
  />
  <Repl
    ref="replRef"
    :theme="theme"
    :editor="Monaco"
    @keydown.ctrl.s.prevent
    @keydown.meta.s.prevent
    :ssr="useSSRMode"
    :store="store"
    :showCompileOutput="true"
    :autoResize="true"
    :clearConsole="false"
    :preview-options="{
      customCode: {
        importCode: `import { initCustomFormatter } from 'vue'`,
        useCode: `initCustomFormatter()`,
      },
    }"
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
