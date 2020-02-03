import { registerRuntimeHelpers } from '@vue/compiler-dom'

export const INTERPOLATE = Symbol(`interpolate`)

registerRuntimeHelpers({
  [INTERPOLATE]: `interpolate`
})
