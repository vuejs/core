// @ts-check
import fs from 'node:fs'

const packagesToCheck = [
  'compiler-sfc',
  'compiler-core',
  'compiler-dom',
  'compiler-ssr',
  'reactivity-transform',
  'shared'
]

let allFilesPresent = true

for (const pkg of packagesToCheck) {
  if (
    !fs.existsSync(
      new URL(`../packages/${pkg}/dist/${pkg}.cjs.js`, import.meta.url)
    )
  ) {
    allFilesPresent = false
    break
  }
}

if (!allFilesPresent) {
  process.exit(1)
}
