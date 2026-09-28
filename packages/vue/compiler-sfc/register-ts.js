import { createRequire } from 'node:module'
import { registerTS } from '@vue/compiler-sfc'

const require = createRequire(import.meta.url)
registerTS(() => require('typescript'))
