import {
  type CompilerError,
  type SourceLocation,
  createCompilerError,
} from '@vue/compiler-dom'

export interface VaporCompilerError extends CompilerError {
  code: VaporErrorCodes
}

export function createVaporCompilerError(
  code: VaporErrorCodes,
  loc?: SourceLocation,
) {
  return createCompilerError(
    code,
    loc,
    VaporErrorMessages,
  ) as VaporCompilerError
}

export enum VaporErrorCodes {
  X_V_PLACEHOLDER = 100,
  X_V_MEMO_NOT_SUPPORTED,
  __EXTEND_POINT__,
}

export const VaporErrorMessages: Record<VaporErrorCodes, string> = {
  [VaporErrorCodes.X_V_PLACEHOLDER]: `[placeholder]`,
  [VaporErrorCodes.X_V_MEMO_NOT_SUPPORTED]:
    'v-memo is not supported in Vapor mode and will be ignored.',

  // just to fulfill types
  [VaporErrorCodes.__EXTEND_POINT__]: ``,
}
