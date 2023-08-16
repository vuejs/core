// @ts-check

import { getExportsSize } from '@sxzz/export-size'
import { mkdir, writeFile } from 'fs/promises'
import path from 'node:path'

const sizeDir = path.resolve('temp/size')

main()

async function main() {
  const { exports } = await getExportsSize({
    pkg: './packages/vue',
    bundler: 'esbuild',
    output: false
  })
  const functions = Object.fromEntries(
    exports.map(exp => {
      return [exp.name, { ...exp, file: path.basename(exp.path) }]
    })
  )
  await mkdir(sizeDir, { recursive: true })
  await writeFile(
    path.resolve(sizeDir, '_exports.json'),
    JSON.stringify(functions, null, 2),
    'utf-8'
  )
}
