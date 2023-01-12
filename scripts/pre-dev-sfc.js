const fs = require('fs')
const path = require('path')

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
      path.resolve(__dirname, `../packages/${pkg}/dist/${pkg}.cjs.js`)
    )
  ) {
    allFilesPresent = false
    break
  }
}

if (!allFilesPresent) {
  process.exit(1)
}
