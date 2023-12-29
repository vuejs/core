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
    __DEV__ || !__BROWSER__ ? VaporErrorMessages : undefined,
  ) as VaporCompilerError
}

export enum VaporErrorCodes {
  X_V_PLACEHOLDER = 100,
  __EXTEND_POINT__,
}

export const VaporErrorMessages: Record<VaporErrorCodes, string> = {
  [VaporErrorCodes.X_V_PLACEHOLDER]: `[placeholder]`,

  // just to fulfill types
  [VaporErrorCodes.__EXTEND_POINT__]: ``,
}
