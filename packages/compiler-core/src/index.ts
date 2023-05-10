export { baseCompile } from './compile'

// Also expose lower level APIs & types
export { BindingTypes } from './options'

export type * from './options'

export { baseParse, TextModes } from './parse'
export {
  transform,
  createTransformContext,
  traverseNode,
  createStructuralDirectiveTransform
} from './transform'

export type * from './transform'

export { generate, type CodegenContext, type CodegenResult } from './codegen'
export {
  ErrorCodes,
  createCompilerError,
  type CoreCompilerError,
  type CompilerError
} from './errors'

export * from './ast'
export * from './utils'
export * from './babelUtils'
export * from './runtimeHelpers'

export { getBaseTransformPreset, type TransformPreset } from './compile'
export { transformModel } from './transforms/vModel'
export { transformOn } from './transforms/vOn'
export { transformBind } from './transforms/vBind'
export { noopDirectiveTransform } from './transforms/noopDirectiveTransform'
export { processIf } from './transforms/vIf'
export { processFor, createForLoopParams } from './transforms/vFor'
export {
  transformExpression,
  processExpression,
  stringifyExpression
} from './transforms/transformExpression'
export {
  buildSlots,
  type SlotFnBuilder,
  trackVForSlotScopes,
  trackSlotScopes
} from './transforms/vSlot'
export {
  transformElement,
  resolveComponentType,
  buildProps,
  buildDirectiveArgs,
  type PropsExpression
} from './transforms/transformElement'
export { processSlotOutlet } from './transforms/transformSlotOutlet'
export { getConstantType } from './transforms/hoistStatic'
export { generateCodeFrame } from '@vue/shared'

// v2 compat only
export {
  checkCompatEnabled,
  warnDeprecation,
  CompilerDeprecationTypes
} from './compat/compatConfig'
