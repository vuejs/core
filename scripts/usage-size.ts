import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { type OutputChunk, rollup } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import { minify } from '@swc/core'
import replace from '@rollup/plugin-replace'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { parseArgs } from 'node:util'
import pico from 'picocolors'
import prettyBytes from 'pretty-bytes'

const {
  values: { write },
} = parseArgs({
  options: {
    write: {
      type: 'boolean',
      default: false,
    },
  },
})

const sizeDir: string = path.resolve('temp/size')
const entry: string = path.resolve(
  './packages/vue/dist/vue.runtime.esm-bundler.js',
)

interface Preset {
  readonly name: string
  readonly imports: string[]
  readonly replace?: Record<string, string>
}

interface BundleResult {
  readonly name: string
  readonly size: number
  readonly gzip: number
  readonly brotli: number
}

const presets: Preset[] = [
  {
    name: 'createApp (CAPI only)',
    imports: ['createApp'],
    replace: { __VUE_OPTIONS_API__: 'false' },
  },
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

async function main(): Promise<void> {
  console.log()
  const tasks: Promise<BundleResult>[] = []
  for (const preset of presets) {
    tasks.push(generateBundle(preset))
  }
  const results: BundleResult[] = await Promise.all(tasks)

  for (const r of results) {
    console.log(
      `${pico.green(pico.bold(r.name))} - ` +
        `min:${prettyBytes(r.size, { minimumFractionDigits: 3 })} / ` +
        `gzip:${prettyBytes(r.gzip, { minimumFractionDigits: 3 })} / ` +
        `brotli:${prettyBytes(r.brotli, { minimumFractionDigits: 3 })}`,
    )
  }

  await mkdir(sizeDir, { recursive: true })
  await writeFile(
    path.resolve(sizeDir, '_usages.json'),
    JSON.stringify(Object.fromEntries(results.map(r => [r.name, r])), null, 2),
    'utf-8',
  )
}

async function generateBundle(preset: Preset): Promise<BundleResult> {
  const id = 'virtual:entry'
  const content = `export { ${preset.imports.join(', ')} } from '${entry}'`

  const result = await rollup({
    input: id,
    plugins: [
      {
        name: 'usage-size-plugin',
        resolveId(_id: string): string | null {
          if (_id === id) return id
          return null
        },
        load(_id: string): string | undefined {
          if (_id === id) return content
          return undefined
        },
      },
      nodeResolve(),
      replace({
        'process.env.NODE_ENV': '"production"',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
        __VUE_OPTIONS_API__: 'true',
        preventAssignment: true,
        ...preset.replace,
      }),
    ],
  })

  const generated = await result.generate({})
  const bundled: string = (generated.output[0] as OutputChunk).code
  const minified: string = (
    await minify(bundled, {
      module: true,
      toplevel: true,
    })
  ).code

  const size: number = minified.length
  const gzip: number = gzipSync(minified).length
  const brotli: number = brotliCompressSync(minified).length

  if (write) {
    await writeFile(path.resolve(sizeDir, preset.name + '.js'), bundled)
  }

  return {
    name: preset.name,
    size,
    gzip,
    brotli,
  }
}
