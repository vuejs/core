export {
  createCompilerError,
  defaultOnError,
  defaultOnWarn,
  type CoreCompilerError,
  type CompilerError,
} from '@vue/compiler-dom'

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
