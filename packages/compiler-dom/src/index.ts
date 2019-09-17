// TODO
export * from '@vue/compiler-core'
import { parserOptionsMinimal } from './parserOptionsMinimal'
import { parserOptionsStandard } from './parserOptionsStandard'

export const parserOptions = __BROWSER__
  ? parserOptionsMinimal
  : parserOptionsStandard
