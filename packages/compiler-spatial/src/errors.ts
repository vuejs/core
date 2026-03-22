import {
  type CompilerError,
  DOMErrorCodes,
  type SourceLocation,
  createCompilerError,
} from '@vue/compiler-dom'

export interface SpatialCompilerError extends CompilerError {
  code: SpatialErrorCodes
}

export function createSpatialCompilerError(
  code: SpatialErrorCodes,
  loc?: SourceLocation,
) {
  return createCompilerError(
    code,
    loc,
    SpatialErrorMessages,
  ) as SpatialCompilerError
}

export enum SpatialErrorCodes {
  X_SPATIAL_UNSUPPORTED_ELEMENT = 65 /* DOMErrorCodes.__EXTEND_POINT__ */,
  X_SPATIAL_INVALID_DIRECTIVE,
  X_SPATIAL_INVALID_AST_NODE,
  X_SPATIAL_V_MODEL_ON_INVALID_ELEMENT,
  X_SPATIAL_MISSING_KEY_IN_FOR,
}

if (__TEST__) {
  if (
    SpatialErrorCodes.X_SPATIAL_UNSUPPORTED_ELEMENT <
    DOMErrorCodes.__EXTEND_POINT__
  ) {
    throw new Error(
      `SpatialErrorCodes need to be updated to ${
        DOMErrorCodes.__EXTEND_POINT__
      } to match extension point from core DOMErrorCodes.`,
    )
  }
}

export const SpatialErrorMessages: { [code: number]: string } = {
  [SpatialErrorCodes.X_SPATIAL_UNSUPPORTED_ELEMENT]: `Unsupported element in spatial template.`,
  [SpatialErrorCodes.X_SPATIAL_INVALID_DIRECTIVE]: `Invalid directive in spatial template.`,
  [SpatialErrorCodes.X_SPATIAL_INVALID_AST_NODE]: `Invalid AST node during spatial transform.`,
  [SpatialErrorCodes.X_SPATIAL_V_MODEL_ON_INVALID_ELEMENT]: `v-model is only supported on <text-field> and <toggle> in spatial templates.`,
  [SpatialErrorCodes.X_SPATIAL_MISSING_KEY_IN_FOR]: `v-for in spatial templates requires a :key binding for ForEach identification.`,
}
