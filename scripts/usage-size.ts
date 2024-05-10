import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { rollup } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import { minify } from 'terser'
import replace from '@rollup/plugin-replace'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const sizeDir = path.resolve('temp/size')
const entry = path.resolve('./packages/vue/dist/vue.runtime.esm-bundler.js')

interface Preset {
  name: string
  imports: string[]
}

const presets: Preset[] = [
  { name: 'createApp', imports: ['createApp'] },
  { name: 'createSSRApp', imports: ['createSSRApp'] },
  { name: 'defineCustomElement', imports: ['defineCustomElement'] },
  {
    name: 'overall',
    imports: [
      'createApp',
      'ref',
      'watch',
      'Transition',
      'KeepAlive',
      'Suspense',
    ],
  },
]

main()

async function main() {
  const tasks: ReturnType<typeof generateBundle>[] = []
  for (const preset of presets) {
    tasks.push(generateBundle(preset))
  }

  const results = Object.fromEntries(
    (await Promise.all(tasks)).map(r => [r.name, r]),
  )

  await mkdir(sizeDir, { recursive: true })
  await writeFile(
    path.resolve(sizeDir, '_usages.json'),
    JSON.stringify(results),
    'utf-8',
  )
}

async function generateBundle(preset: Preset) {
  const id = 'virtual:entry'
  const content = `export { ${preset.imports.join(', ')} } from '${entry}'`
  const result = await rollup({
    input: id,
    plugins: [
      {
        name: 'usage-size-plugin',
        resolveId(_id) {
          if (_id === id) return id
          return null
        },
        load(_id) {
          if (_id === id) return content
        },
      },
      nodeResolve(),
      replace({
        'process.env.NODE_ENV': '"production"',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
        __VUE_OPTIONS_API__: 'true',
        preventAssignment: true,
      }),
    ],
  })

  const generated = await result.generate({})
  const bundled = generated.output[0].code
  const minified = (
    await minify(bundled, {
      module: true,
      toplevel: true,
    })
  ).code!

  const size = minified.length
  const gzip = gzipSync(minified).length
  const brotli = brotliCompressSync(minified).length

  return {
    name: preset.name,
    size,
    gzip,
    brotli,
  }
}
