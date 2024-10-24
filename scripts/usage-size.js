// @ts-check
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { rollup } from 'rollup'
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

const sizeDir = path.resolve('temp/size')
const entry = path.resolve('./packages/vue/dist/vue.runtime.esm-bundler.js')

/**
 * @typedef {Object} Preset
 * @property {string} name - The name of the preset
 * @property {string[]} imports - The imports that are part of this preset
 * @property {Record<string, string>} [replace]
 */

/** @type {Preset[]} */
const presets = [
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

/**
 * Main function that initiates the bundling process for the presets
 */
async function main() {
  console.log()
  /** @type {Promise<{name: string, size: number, gzip: number, brotli: number}>[]} */
  const tasks = []
  for (const preset of presets) {
    tasks.push(generateBundle(preset))
  }
  const results = await Promise.all(tasks)

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

/**
 * Generates a bundle for a given preset
 *
 * @param {Preset} preset - The preset to generate the bundle for
 * @returns {Promise<{name: string, size: number, gzip: number, brotli: number}>} - The result of the bundling process
 */
async function generateBundle(preset) {
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
        ...preset.replace,
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
  ).code

  const size = minified.length
  const gzip = gzipSync(minified).length
  const brotli = brotliCompressSync(minified).length

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
