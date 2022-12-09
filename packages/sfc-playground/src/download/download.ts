import { saveAs } from 'file-saver'

import indexTemplate from './template/index.html?raw'
import mainTemplate from './template/main.js?raw'
import pkg from './template/package.json?raw'
import config from './template/vite.config.js?raw'
import readme from './template/README.md?raw'

export async function downloadProject(store: any) {
  if (!confirm('Download project files?')) {
    return
  }

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  const { mainFile } = store.state
  const isMainFileJs = mainFile.endsWith('.js') || mainFile.endsWith('.ts')

  const index = isMainFileJs
    ? indexTemplate.replace('/src/main.js', `/src/${mainFile}`)
    : indexTemplate

  // basic structure
  zip.file('index.html', index)
  zip.file('package.json', pkg)
  zip.file('vite.config.js', config)
  zip.file('README.md', readme)

  // project src
  const src = zip.folder('src')!

  if (!isMainFileJs) {
    const main = mainFile.endsWith('.vue')
      ? mainTemplate.replace('./App.vue', `./${mainFile}`)
      : mainTemplate

    src.file('main.js', main)
  }

  const files = store.getFiles()
  for (const file in files) {
    src.file(file, files[file])
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, 'vue-project.zip')
}
