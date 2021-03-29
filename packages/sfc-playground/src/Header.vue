<template>
  <nav>
    <h1>Vue SFC Playground</h1>

    <button class="share" @click="copyLink">
      <svg width="1.4em" height="1.4em" viewBox="0 0 24 24">
        <g fill="none" stroke="#626262" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <path d="M8.59 13.51l6.83 3.98"/>
          <path d="M15.41 6.51l-6.82 3.98"/>
        </g>
      </svg>
    </button>

    <button class="download" @click="downloadProject">
      <svg width="1.7em" height="1.7em" viewBox="0 0 24 24">
        <g fill="#626262">
          <rect x="4" y="18" width="16" height="2" rx="1" ry="1"/>
          <rect x="3" y="17" width="4" height="2" rx="1" ry="1" transform="rotate(-90 5 18)"/>
          <rect x="17" y="17" width="4" height="2" rx="1" ry="1" transform="rotate(-90 19 18)"/>
          <path d="M12 15a1 1 0 0 1-.58-.18l-4-2.82a1 1 0 0 1-.24-1.39a1 1 0 0 1 1.4-.24L12 12.76l3.4-2.56a1 1 0 0 1 1.2 1.6l-4 3a1 1 0 0 1-.6.2z"/><path d="M12 13a1 1 0 0 1-1-1V4a1 1 0 0 1 2 0v8a1 1 0 0 1-1 1z"/>
        </g>
      </svg>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { exportFiles } from './store'
import { saveAs } from 'file-saver'

function copyLink() {
  navigator.clipboard.writeText(location.href)
  alert('Sharable URL has been copied to clipboard.')
}

async function downloadProject() {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  // basic structure

  // project src
  const src = zip.folder('src')!
  const files = exportFiles()
  for (const file in files) {
    src.file(file, files[file])
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, 'vue-project.zip')
}
</script>

<style>
nav {
  height: var(--nav-height);
  box-sizing: border-box;
  padding: 0 1em;
  background-color: #fff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.33);
  position: relative;
  z-index: 999;
}

h1 {
  margin: 0;
  line-height: var(--nav-height);
  font-weight: 500;
}

.share {
  position: absolute;
  top: 14px;
  right: 56px;
}

.download {
  position: absolute;
  top: 13px;
  right: 16px;
}
</style>
