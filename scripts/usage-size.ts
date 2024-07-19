import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { rollup } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import { minify } from '@swc/core'
import replace from '@rollup/plugin-replace'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const sizeDir = path.resolve('temp/size')
const vue = path.resolve('./packages/vue/dist/vue.runtime.esm-bundler.js')
const vapor = path.resolve(
  './packages/vue-vapor/dist/vue-vapor.runtime.esm-bundler.js',
)

interface Preset {
  name: string
  imports: '*' | string[]
  from: string
}

const presets: Preset[] = [
  { name: 'createApp', imports: ['createApp'], from: vue },
  { name: 'createSSRApp', imports: ['createSSRApp'], from: vue },
  {
    name: 'defineCustomElement',
    imports: ['defineCustomElement'],
    from: vue,
  },
  { name: 'vapor', imports: '*', from: vapor },
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
    from: vue,
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
  const exportSpecifiers =
    preset.imports === '*'
      ? `* as ${preset.name}`
      : `{ ${preset.imports.join(', ')} }`
  const content = `export ${exportSpecifiers} from '${preset.from}'`
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
