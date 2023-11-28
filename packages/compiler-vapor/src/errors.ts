import { CompilerError } from '@vue/compiler-dom'

export { createCompilerError } from '@vue/compiler-dom'

export function defaultOnError(error: CompilerError) {
  throw error
}

export function defaultOnWarn(msg: CompilerError) {
  __DEV__ && console.warn(`[Vue warn] ${msg.message}`)
}

export const enum ErrorCodes {
  // transform errors
  VAPOR_BIND_NO_EXPRESSION,
  VAPOR_ON_NO_EXPRESSION,
}

export const errorMessages: Record<ErrorCodes, string> = {
  // transform errors
  [ErrorCodes.VAPOR_BIND_NO_EXPRESSION]: `v-bind is missing expression.`,
  [ErrorCodes.VAPOR_ON_NO_EXPRESSION]: `v-on is missing expression.`,
}
