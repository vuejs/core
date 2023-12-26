import {
  type CompilerError,
  DOMErrorCodes,
  type SourceLocation,
  createCompilerError,
} from '@vue/compiler-dom'

export interface SSRCompilerError extends CompilerError {
  code: SSRErrorCodes
}

export function createSSRCompilerError(
  code: SSRErrorCodes,
  loc?: SourceLocation,
) {
  return createCompilerError(code, loc, SSRErrorMessages) as SSRCompilerError
}

export enum SSRErrorCodes {
  X_SSR_UNSAFE_ATTR_NAME = 65 /* DOMErrorCodes.__EXTEND_POINT__ */,
  X_SSR_NO_TELEPORT_TARGET,
  X_SSR_INVALID_AST_NODE,
}

if (__TEST__) {
  // esbuild cannot infer enum increments if first value is from another
  // file, so we have to manually keep them in sync. this check ensures it
  // errors out if there are collisions.
  if (SSRErrorCodes.X_SSR_UNSAFE_ATTR_NAME < DOMErrorCodes.__EXTEND_POINT__) {
    throw new Error(
      `SSRErrorCodes need to be updated to ${
        DOMErrorCodes.__EXTEND_POINT__ + 1
      } to match extension point from core DOMErrorCodes.`,
    )
  }
}

export const SSRErrorMessages: { [code: number]: string } = {
  [SSRErrorCodes.X_SSR_UNSAFE_ATTR_NAME]: `Unsafe attribute name for SSR.`,
  [SSRErrorCodes.X_SSR_NO_TELEPORT_TARGET]: `Missing the 'to' prop on teleport element.`,
  [SSRErrorCodes.X_SSR_INVALID_AST_NODE]: `Invalid AST node during SSR transform.`,
}
