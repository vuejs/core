import { reactive, watchEffect } from 'vue'
import { compileFile, MAIN_FILE } from './sfcCompiler'
import { utoa, atou } from './utils'

const welcomeCode = `
<template>
  <h1>{{ msg }}</h1>
</template>

<script setup>
const msg = 'Hello World!'
</script>
`.trim()

export class File {
  filename: string
  code: string
  compiled = {
    js: '',
    css: '',
    ssr: ''
  }

  constructor(filename: string, code = '') {
    this.filename = filename
    this.code = code
  }
}

interface Store {
  files: Record<string, File>
  activeFilename: string
  readonly activeFile: File
  readonly importMap: string | undefined
  errors: (string | Error)[]
}

let files: Store['files'] = {}

const savedFiles = location.hash.slice(1)
if (savedFiles) {
  const saved = JSON.parse(atou(savedFiles))
  for (const filename in saved) {
    files[filename] = new File(filename, saved[filename])
  }
} else {
  files = {
    'App.vue': new File(MAIN_FILE, welcomeCode)
  }
}

export const store: Store = reactive({
  files,
  activeFilename: MAIN_FILE,
  get activeFile() {
    return store.files[store.activeFilename]
  },
  get importMap() {
    const file = store.files['import-map.json']
    return file && file.code
  },
  errors: []
})

watchEffect(() => compileFile(store.activeFile))

for (const file in store.files) {
  if (file !== MAIN_FILE) {
    compileFile(store.files[file])
  }
}

watchEffect(() => {
  history.replaceState({}, '', '#' + utoa(JSON.stringify(exportFiles())))
})

export function exportFiles() {
  const exported: Record<string, string> = {}
  for (const filename in store.files) {
    exported[filename] = store.files[filename].code
  }
  return exported
}

export function setActive(filename: string) {
  store.activeFilename = filename
}

export function addFile(filename: string) {
  const file = (store.files[filename] = new File(filename))

  if (filename === 'import-map.json') {
    file.code = `
{
  "imports": {

  }
}`.trim()
  }

  setActive(filename)
}

export function deleteFile(filename: string) {
  if (confirm(`Are you sure you want to delete ${filename}?`)) {
    if (store.activeFilename === filename) {
      store.activeFilename = MAIN_FILE
    }
    delete store.files[filename]
  }
}
