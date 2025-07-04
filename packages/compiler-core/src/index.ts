export { baseCompile } from './compile'

// Also expose lower level APIs & types
export {
  type CompilerOptions,
  type ParserOptions,
  type TransformOptions,
  type CodegenOptions,
  type HoistTransform,
  type BindingMetadata,
  BindingTypes,
} from './options'
export { baseParse } from './parser'
export {
  transform,
  type TransformContext,
  createTransformContext,
  traverseNode,
  createStructuralDirectiveTransform,
  getSelfName,
  type NodeTransform,
  type StructuralDirectiveTransform,
  type DirectiveTransform,
} from './transform'
export {
  generate,
  NewlineType,
  type CodegenContext,
  type CodegenResult,
  type CodegenSourceMapGenerator,
  type RawSourceMap,
  type BaseCodegenResult,
} from './codegen'
export {
  ErrorCodes,
  errorMessages,
  createCompilerError,
  defaultOnError,
  defaultOnWarn,
  type CoreCompilerError,
  type CompilerError,
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
  stringifyExpression,
  isLiteralWhitelisted,
} from './transforms/transformExpression'
export {
  buildSlots,
  type SlotFnBuilder,
  trackVForSlotScopes,
  trackSlotScopes,
} from './transforms/vSlot'
export {
  transformElement,
  resolveComponentType,
  buildProps,
  buildDirectiveArgs,
  type PropsExpression,
} from './transforms/transformElement'
export { processSlotOutlet } from './transforms/transformSlotOutlet'
export { getConstantType } from './transforms/cacheStatic'
export { generateCodeFrame } from '@vue/shared'

// v2 compat only
export {
  checkCompatEnabled,
  warnDeprecation,
  CompilerDeprecationTypes,
  type CompilerCompatOptions,
} from './compat/compatConfig'
