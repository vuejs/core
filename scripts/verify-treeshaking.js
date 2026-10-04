// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { rolldown } from 'rolldown'
import { replacePlugin } from 'rolldown/plugins'
import { exec } from './utils.js'

exec('vp', [
  'run',
  'build',
  'vue',
  'runtime-vapor',
  'runtime-dom',
  'runtime-core',
  'reactivity',
  'shared',
  '-f',
  'global-runtime+esm-bundler-runtime+esm-bundler',
]).then(async () => {
  const errors = []

  const devBuild = fs.readFileSync(
    'packages/vue/dist/vue.runtime.global.js',
    'utf-8',
  )

  if (devBuild.includes('__spreadValues')) {
    errors.push(
      'dev build contains unexpected object spread helper.\n' +
        'This means { ...obj } syntax is used in runtime code. This should be ' +
        'refactored to use the `extend` helper to avoid the extra code.',
    )
  }

  const prodBuild = fs.readFileSync(
    'packages/vue/dist/vue.runtime.global.prod.js',
    'utf-8',
  )

  if (prodBuild.includes('Vue warn')) {
    errors.push(
      'prod build contains unexpected warning-related code.\n' +
        'This means there are calls of warn() that are not guarded by the __DEV__ condition.',
    )
  }

  if (
    prodBuild.includes('html,body,base') ||
    prodBuild.includes('svg,animate,animateMotion') ||
    prodBuild.includes('annotation,annotation-xml,maction')
  ) {
    errors.push(
      'prod build contains unexpected domTagConfig lists.\n' +
        'This means helpers like isHTMLTag() is used in runtime code paths when it should be compiler-only.',
    )
  }

  // Bundle CSR entry points without the SSR APIs.
  const vuePath = path.resolve('packages/vue/dist/vue.runtime.esm-bundler.js')
  const presets = [
    {
      name: 'Vapor CSR',
      imports: `createVaporApp, defineVaporComponent, defineVaporAsyncComponent,
        defineVaporCustomElement, createComponent, createDynamicComponent,
        createPlainElement, createIf, createFor, createKeyedFragment,
        createSlot, template, child, nthChild, next, txt,
        renderEffect, setText, setDynamicProps, applyDynamicModel,
        VaporTeleport, VaporKeepAlive, VaporTransition, VaporTransitionGroup`,
    },
    {
      name: 'createApp + vaporInteropPlugin CSR',
      imports: 'createApp, vaporInteropPlugin',
    },
  ]
  for (const { name, imports } of presets) {
    const id = 'virtual:vapor-csr'
    const bundle = await rolldown({
      input: id,
      plugins: [
        {
          name: 'vapor-csr',
          resolveId(source) {
            if (source === id) return id
          },
          load(source) {
            if (source === id) {
              return `export { ${imports} } from ${JSON.stringify(vuePath)}`
            }
          },
        },
        replacePlugin(
          {
            'process.env.NODE_ENV': '"production"',
            __VUE_OPTIONS_API__: 'true',
            __VUE_PROD_DEVTOOLS__: 'false',
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
          },
          { preventAssignment: true },
        ),
      ],
      tsconfig: false,
      treeshake: { moduleSideEffects: false },
    })
    // Preserve names so the checks also catch hydration code without warnings.
    const { output } = await bundle.generate({ minify: 'dce-only' })
    await bundle.close()
    const csrBuild = output[0].code
    for (const marker of ['setIsHydrating', 'currentHydrationNode']) {
      if (csrBuild.includes(marker)) {
        errors.push(
          `${name} build contains unexpected hydration code: ${marker}.\n` +
            'Hydration logic should be guarded by isHydrating so it can be tree-shaken when SSR APIs are not used.',
        )
      }
    }
  }

  if (errors.length) {
    throw new Error(
      `Found the following treeshaking errors:\n\n- ${errors.join('\n\n- ')}`,
    )
  }
})
