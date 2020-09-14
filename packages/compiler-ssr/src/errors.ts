import {
  SourceLocation,
  CompilerError,
  createCompilerError,
  DOMErrorCodes
} from '@vue/compiler-dom'

export interface SSRCompilerError extends CompilerError {
  code: SSRErrorCodes
}

export function createSSRCompilerError(
  code: SSRErrorCodes,
  loc?: SourceLocation
): SSRCompilerError {
  return createCompilerError(code, loc, SSRErrorMessages)
}

export const enum SSRErrorCodes {
  X_SSR_CUSTOM_DIRECTIVE_NO_TRANSFORM = DOMErrorCodes.__EXTEND_POINT__,
  X_SSR_UNSAFE_ATTR_NAME,
  X_SSR_NO_TELEPORT_TARGET,
  X_SSR_INVALID_AST_NODE
}

export const SSRErrorMessages: { [code: number]: string } = {
  [SSRErrorCodes.X_SSR_CUSTOM_DIRECTIVE_NO_TRANSFORM]: `Custom directive is missing corresponding SSR transform and will be ignored.`,
  [SSRErrorCodes.X_SSR_UNSAFE_ATTR_NAME]: `Unsafe attribute name for SSR.`,
  [SSRErrorCodes.X_SSR_NO_TELEPORT_TARGET]: `No target prop on teleport element.`,
  [SSRErrorCodes.X_SSR_INVALID_AST_NODE]: `Invalid AST node during SSR transform.`
}
