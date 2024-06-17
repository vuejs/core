// @ts-check
import fs from 'node:fs'
import { execa } from 'execa'

execa('pnpm', ['build', 'vue', '-f', 'global-runtime']).then(() => {
  const errors = []

  const devBuild = fs.readFileSync(
    'packages/vue/dist/vue.runtime.global.js',
    'utf-8',
  )

  if (devBuild.includes('__spreadValues')) {
    errors.push(
      'dev build contains unexpected esbuild object spread helper.\n' +
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
      'prod build contains unexpected domTagConifg lists.\n' +
        'This means helpers like isHTMLTag() is used in runtime code paths when it should be compiler-only.',
    )
  }

  if (errors.length) {
    throw new Error(
      `Found the following treeshaking errors:\n\n- ${errors.join('\n\n- ')}`,
    )
  }
})
