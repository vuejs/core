<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Copy from './icons/Copy.vue'

const expanded = ref(false)
const versions = ref<string[]>()

const version = defineModel()
const props = defineProps<{
  pkg: string
  label: string
}>()

async function toggle() {
  expanded.value = !expanded.value
  if (!versions.value) {
    versions.value = await fetchVersions()
  }
}

async function fetchVersions(): Promise<string[]> {
  const res = await fetch(
    `https://data.jsdelivr.com/v1/package/npm/${props.pkg}`,
  )
  const { versions } = (await res.json()) as { versions: string[] }

  if (props.pkg === 'vue') {
    // If the latest Vue version is a pre-release, include up to 10 of the
    // current pre-releases so stable releases still have room in the list.
    // Once a stable release is reached, skip all older pre-releases.
    let isInPreRelease = versions[0].includes('-')
    let preReleaseCount = 0
    const filteredVersions: string[] = []
    for (const v of versions) {
      if (v.includes('-')) {
        if (isInPreRelease && preReleaseCount < 10) {
          filteredVersions.push(v)
          preReleaseCount++
        }
      } else {
        filteredVersions.push(v)
        isInPreRelease = false
      }
      if (filteredVersions.length >= 30) {
        break
      }
    }
    return filteredVersions
  } else if (props.pkg === 'typescript') {
    return versions.filter(v => !v.includes('dev') && !v.includes('insiders'))
  }
  return versions
}

function setVersion(v: string) {
  version.value = v
  expanded.value = false
}

function copyVersion(v: string) {
  window.navigator.clipboard.writeText(v).then(() => {
    alert(
      `${props.label.replace(/Version$/, 'version')} has been copied to clipboard.`,
    )
  })
}

onMounted(() => {
  window.addEventListener('click', () => {
    expanded.value = false
  })
  window.addEventListener('blur', () => {
    if (document.activeElement?.tagName === 'IFRAME') {
      expanded.value = false
    }
  })
})
</script>

<template>
  <div class="version" @click.stop>
    <span class="active-version" @click="toggle">
      {{ label }}
      <span class="number">{{ version }}</span>
    </span>

    <ul class="versions" :class="{ expanded }">
      <li v-if="!versions"><a>loading versions...</a></li>
      <li
        v-for="(ver, index) of versions"
        class="versions-item"
        :class="{
          active: ver === version || (version === 'latest' && index === 0),
        }"
      >
        <a @click="setVersion(ver)">v{{ ver }}</a>
        <button
          title="Copy Version"
          class="version-copy"
          @click="copyVersion(`v${ver}`)"
        >
          <Copy />
        </button>
      </li>
      <div @click="expanded = false">
        <slot />
      </div>
    </ul>
  </div>
</template>

<style>
.version {
  z-index: 1;
  margin-right: 12px;
  position: relative;
}

.active-version {
  cursor: pointer;
  position: relative;
  display: inline-flex;
  place-items: center;
}

.active-version .number {
  color: var(--green);
  margin-left: 4px;
}

.active-version::after {
  content: '';
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 6px solid #aaa;
  margin-left: 8px;
}

.versions .active a {
  color: var(--green);
}

.versions .versions-item {
  display: flex;
  justify-content: space-between;
}

.versions .versions-item .version-copy {
  display: none;
}

.versions .versions-item:hover .version-copy {
  display: block;
}
</style>
