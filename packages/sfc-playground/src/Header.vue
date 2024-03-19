<script setup lang="ts">
import { computed } from 'vue'
import type { ReplStore } from '@vue/repl'
import { downloadProject } from './download/download'
import Sun from './icons/Sun.vue'
import Moon from './icons/Moon.vue'
import Share from './icons/Share.vue'
import Download from './icons/Download.vue'
import GitHub from './icons/GitHub.vue'
import Reload from './icons/Reload.vue'
import VersionSelect from './VersionSelect.vue'

const props = defineProps<{
  store: ReplStore
  prod: boolean
  ssr: boolean
}>()
const emit = defineEmits([
  'toggle-theme',
  'toggle-ssr',
  'toggle-prod',
  'reload-page',
])

const { store } = props

const currentCommit = __COMMIT__

const vueVersion = computed(() => {
  if (store.loading) {
    return 'loading...'
  }
  return store.vueVersion || `@${__COMMIT__}`
})

async function setVueVersion(v: string) {
  store.vueVersion = v
}

function resetVueVersion() {
  store.vueVersion = null
}

async function copyLink(e: MouseEvent) {
  if (e.metaKey) {
    // hidden logic for going to local debug from play.vuejs.org
    window.location.href = 'http://localhost:5173/' + window.location.hash
    return
  }
  await navigator.clipboard.writeText(location.href)
  alert('Sharable URL has been copied to clipboard.')
}

function toggleDark() {
  const cls = document.documentElement.classList
  cls.toggle('dark')
  localStorage.setItem(
    'vue-sfc-playground-prefer-dark',
    String(cls.contains('dark')),
  )
  emit('toggle-theme', cls.contains('dark'))
}
</script>

<template>
  <nav>
    <h1>
      <img alt="logo" src="/logo.svg" />
      <span>Vue SFC Playground</span>
    </h1>
    <div class="links">
      <VersionSelect
        v-model="store.typescriptVersion"
        pkg="typescript"
        label="TypeScript Version"
      />
      <VersionSelect
        :model-value="vueVersion"
        @update:model-value="setVueVersion"
        pkg="vue"
        label="Vue Version"
      >
        <li>
          <a @click="resetVueVersion">This Commit ({{ currentCommit }})</a>
        </li>
        <li>
          <a
            href="https://app.netlify.com/sites/vue-sfc-playground/deploys"
            target="_blank"
            >Commits History</a
          >
        </li>
      </VersionSelect>
      <button
        title="Toggle development production mode"
        class="toggle-prod"
        :class="{ prod }"
        @click="$emit('toggle-prod')"
      >
        <span>{{ prod ? 'PROD' : 'DEV' }}</span>
      </button>
      <button
        title="Toggle server rendering mode"
        class="toggle-ssr"
        :class="{ enabled: ssr }"
        @click="$emit('toggle-ssr')"
      >
        <span>{{ ssr ? 'SSR ON' : 'SSR OFF' }}</span>
      </button>
      <button title="Toggle dark mode" class="toggle-dark" @click="toggleDark">
        <Sun class="light" />
        <Moon class="dark" />
      </button>
      <button title="Copy sharable URL" class="share" @click="copyLink">
        <Share />
      </button>
      <button title="Reload page" class="reload" @click="$emit('reload-page')">
        <Reload />
      </button>
      <button
        title="Download project files"
        class="download"
        @click="downloadProject(store)"
      >
        <Download />
      </button>
      <a
        href="https://github.com/vuejs/core/tree/main/packages/sfc-playground"
        target="_blank"
        title="View on GitHub"
        class="github"
      >
        <GitHub />
      </a>
    </div>
  </nav>
</template>

<style>
nav {
  --bg: #fff;
  --bg-light: #fff;
  --border: #ddd;
  --btn: #666;
  --highlight: #333;
  --green: #3ca877;
  --purple: #904cbc;
  --btn-bg: #eee;

  color: var(--base);
  height: var(--nav-height);
  box-sizing: border-box;
  padding: 0 1em;
  background-color: var(--bg);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.33);
  position: relative;
  z-index: 999;
  display: flex;
  justify-content: space-between;
}

.dark nav {
  --base: #ddd;
  --bg: #1a1a1a;
  --bg-light: #242424;
  --border: #383838;
  --highlight: #fff;
  --btn-bg: #333;

  box-shadow: none;
  border-bottom: 1px solid var(--border);
}

h1 {
  font-weight: 500;
  display: inline-flex;
  place-items: center;
}

h1 img {
  height: 24px;
  margin-right: 10px;
}

@media (max-width: 560px) {
  h1 span {
    font-size: 0.9em;
  }
}

@media (max-width: 520px) {
  h1 span {
    display: none;
  }
}

.links {
  display: flex;
}

.toggle-prod span,
.toggle-ssr span {
  font-size: 12px;
  border-radius: 4px;
  padding: 4px 6px;
}

.toggle-prod span {
  background: var(--green);
  color: #fff;
}

.toggle-prod.prod span {
  background: var(--purple);
}

.toggle-ssr span {
  background-color: var(--btn-bg);
}

.toggle-ssr.enabled span {
  color: #fff;
  background-color: var(--green);
}

.toggle-dark svg {
  width: 18px;
  height: 18px;
}

.toggle-dark .dark,
.dark .toggle-dark .light {
  display: none;
}

.dark .toggle-dark .dark {
  display: inline-block;
}

.links button,
.links .github {
  padding: 1px 6px;
  color: var(--btn);
}

.links button:hover,
.links .github:hover {
  color: var(--highlight);
}

.version:hover .active-version::after {
  border-top-color: var(--btn);
}

.dark .version:hover .active-version::after {
  border-top-color: var(--highlight);
}

.versions {
  display: none;
  position: absolute;
  left: 0;
  top: 40px;
  background-color: var(--bg-light);
  border: 1px solid var(--border);
  border-radius: 4px;
  list-style-type: none;
  padding: 8px;
  margin: 0;
  width: 200px;
  max-height: calc(100vh - 70px);
  overflow: scroll;
}

.versions a {
  display: block;
  padding: 6px 12px;
  text-decoration: none;
  cursor: pointer;
  color: var(--base);
}

.versions a:hover {
  color: var(--green);
}

.versions.expanded {
  display: block;
}

.links > * {
  display: flex;
  align-items: center;
}

.links > * + * {
  margin-left: 4px;
}
</style>
