// @ts-check
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { rolldown } from 'rolldown'
import { minify } from 'oxc-minify'
import { replacePlugin } from 'rolldown/plugins'
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
const vuePath = path.resolve('./packages/vue/dist/vue.runtime.esm-bundler.js')
const appDir = path.resolve('scripts/size-app')

/**
 * @typedef {Object} Preset
 * @property {string} name - The name of the preset
 * @property {'*' | string[]} [imports] - The imports that are part of this preset
 * @property {string} [app] - Bundle the SFC app in scripts/size-app/<app> instead
 * @property {boolean} [vapor] - Compile the app SFCs in vapor mode
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
  {
    name: 'createApp + vaporInteropPlugin',
    imports: ['createApp', 'vaporInteropPlugin'],
  },
  { name: 'createVaporApp', imports: ['createVaporApp'] },
  { name: 'createSSRApp', imports: ['createSSRApp'] },
  { name: 'createVaporSSRApp', imports: ['createVaporSSRApp'] },
  { name: 'defineCustomElement', imports: ['defineCustomElement'] },
  { name: 'defineVaporCustomElement', imports: ['defineVaporCustomElement'] },
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
  ...['counter', 'todo'].flatMap(app => [
    {
      name: `${app} app (CAPI only)`,
      app,
      replace: { __VUE_OPTIONS_API__: 'false' },
    },
    {
      name: `${app} vapor app (CAPI only)`,
      app,
      vapor: true,
      replace: { __VUE_OPTIONS_API__: 'false' },
    },
  ]),
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
  const writeJSON = async (
    /** @type {string} */ file,
    /** @type {typeof results} */ list,
  ) =>
    writeFile(
      path.resolve(sizeDir, file),
      JSON.stringify(Object.fromEntries(list.map(r => [r.name, r])), null, 2),
      'utf-8',
    )
  await writeJSON(
    '_usages.json',
    results.filter((_, i) => !presets[i].app),
  )
  await writeJSON(
    '_apps.json',
    results.filter((_, i) => presets[i].app),
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
  let content
  if (preset.app) {
    const create = preset.vapor ? 'createVaporApp' : 'createApp'
    content =
      `import { ${create} } from 'vue'\n` +
      `import App from '${appDir}/${preset.app}/App.vue'\n` +
      `${create}(App).mount('#app')`
  } else {
    const imports = preset.imports || []
    const exportSpecifiers =
      imports === '*' ? `* as ${preset.name}` : `{ ${imports.join(', ')} }`
    content = `export ${exportSpecifiers} from '${vuePath}'`
  }

  const result = await rolldown({
    input: id,
    plugins: [
      {
        name: 'usage-size-plugin',
        resolveId(_id) {
          if (_id === id) return id
          if (_id === 'vue') return vuePath
          return null
        },
        async load(_id) {
          if (_id === id) return content
          if (_id.endsWith('.vue')) {
            return compileSFC(_id, !!preset.vapor)
          }
        },
      },
      replacePlugin(
        {
          'process.env.NODE_ENV': '"production"',
          __VUE_PROD_DEVTOOLS__: 'false',
          __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
          __VUE_OPTIONS_API__: 'true',
          ...preset.replace,
        },
        { preventAssignment: true },
      ),
    ],
    tsconfig: false,
    treeshake: {
      moduleSideEffects: false,
    },
  })

  const generated = await result.generate({
    minify: 'dce-only',
  })
  const bundled = generated.output[0].code
  const file = preset.name + '.js'
  const minified = (
    await minify(file, bundled, {
      module: true,
      mangle: {
        toplevel: true,
      },
    })
  ).code
  const size = minified.length
  const gzip = gzipSync(minified).length
  const brotli = brotliCompressSync(minified).length

  if (write) {
    await writeFile(path.resolve(sizeDir, file), bundled)
  }

  return {
    name: preset.name,
    size,
    gzip,
    brotli,
  }
}

/**
 * Compiles an SFC the same way @vitejs/plugin-vue does for production
 *
 * @param {string} filename
 * @param {boolean} vapor
 * @returns {Promise<{ code: string, moduleType: 'ts' }>}
 */
async function compileSFC(filename, vapor) {
  // only used to precompile the app SFCs, built by the `size-prepare-app` script
  const { parse, compileScript } = createRequire(import.meta.url)(
    '../packages/compiler-sfc',
  )
  const { descriptor, errors } = parse(await readFile(filename, 'utf-8'), {
    filename,
  })
  if (errors.length) throw errors[0]
  const { content } = compileScript(descriptor, {
    id: path.relative(appDir, filename),
    isProd: true,
    inlineTemplate: true,
    vapor,
  })
  return { code: content, moduleType: 'ts' }
}
