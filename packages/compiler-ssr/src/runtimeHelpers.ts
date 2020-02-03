import { registerRuntimeHelpers } from '@vue/compiler-core'

export const INTERPOLATE = Symbol(`interpolate`)

registerRuntimeHelpers({
  [INTERPOLATE]: `interpolate`
})
