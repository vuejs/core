// @ts-check

import { watch } from 'rolldown'
import { createConfigsForPackage } from './create-rolldown-config.js'
import { parseArgs } from 'node:util'

const {
  values: { format: rawFormat, prod, inline: inlineDeps },
  positionals,
} = parseArgs({
  allowPositionals: true,
  options: {
    format: {
      type: 'string',
      short: 'f',
      default: 'global',
    },
    prod: {
      type: 'boolean',
      short: 'p',
      default: false,
    },
    inline: {
      type: 'boolean',
      short: 'i',
      default: false,
    },
  },
})

const format = rawFormat || 'global'
const target = positionals.length ? positionals[0] : 'vue'

const [config, prodConfig] = createConfigsForPackage({
  target,
  commit: 'dev',
  // @ts-expect-error
  formats: [format],
  devOnly: !prod,
  sourceMap: true,
  localDev: true,
  inlineDeps,
})

const configToUse = prod ? prodConfig : config

// @ts-expect-error
console.log(`watching: ${configToUse.output.file}`)
watch(configToUse).on('event', event => {
  if (event.code === 'BUNDLE_END') {
    // @ts-expect-error
    console.log(`rebuilt ${config.output.file} in ${event.duration}ms`)
  }
})
