import type { CompilerError } from '@vue/compiler-dom'

export { createCompilerError } from '@vue/compiler-dom'
export function defaultOnError(error: CompilerError) {
  throw error
}

export function defaultOnWarn(msg: CompilerError) {
  __DEV__ && console.warn(`[Vue warn] ${msg.message}`)
}

export enum VaporErrorCodes {
  // transform errors
  X_VAPOR_BIND_NO_EXPRESSION,
  X_VAPOR_ON_NO_EXPRESSION,

  // generic errors
  X_PREFIX_ID_NOT_SUPPORTED,
  X_MODULE_MODE_NOT_SUPPORTED,
}

export const errorMessages: Record<VaporErrorCodes, string> = {
  // transform errors
  [VaporErrorCodes.X_VAPOR_BIND_NO_EXPRESSION]: `v-bind is missing expression.`,
  [VaporErrorCodes.X_VAPOR_ON_NO_EXPRESSION]: `v-on is missing expression.`,

  [VaporErrorCodes.X_PREFIX_ID_NOT_SUPPORTED]: `"prefixIdentifiers" option is not supported in this build of compiler.`,
  [VaporErrorCodes.X_MODULE_MODE_NOT_SUPPORTED]: `ES module mode is not supported in this build of compiler.`,
}
