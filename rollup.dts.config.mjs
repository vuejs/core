// @ts-check
import { existsSync, readdirSync, readFileSync } from 'fs'
import dts from 'rollup-plugin-dts'

if (!existsSync('temp/packages')) {
  console.warn(
    'no temp dts files found. run `tsc -p tsconfig.build.json` first.'
  )
  process.exit(1)
}

export default readdirSync('temp/packages').map(pkg => {
  return {
    input: `./temp/packages/${pkg}/src/index.d.ts`,
    output: {
      file: `packages/${pkg}/dist/${pkg}.d.ts`,
      format: 'es'
    },
    plugins: [dts(), patchTypes(pkg)],
    onwarn(warning, warn) {
      // during dts rollup, everything is externalized by default
      if (
        warning.code === 'UNRESOLVED_IMPORT' &&
        !warning.exporter.startsWith('.')
      ) {
        return
      }
      warn(warning)
    }
  }
})

/**
 * @returns {import('rollup').Plugin}
 */
function patchTypes(pkg) {
  return {
    name: 'patch-types',
    renderChunk(code) {
      // 1. TODO remove entries marked with @private
      // 2. append pkg specific types
      const additionalTypeDir = `packages/${pkg}/types`
      if (existsSync(additionalTypeDir)) {
        code +=
          '\n' +
          readdirSync(additionalTypeDir)
            .map(file => readFileSync(`${additionalTypeDir}/${file}`, 'utf-8'))
            .join('\n')
      }
      return code
    }
  }
}
