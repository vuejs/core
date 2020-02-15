export { baseCompile } from './compile'

// Also expose lower level APIs & types
export {
  CompilerOptions,
  ParserOptions,
  TransformOptions,
  CodegenOptions,
  HoistTransform
} from './options'
export { baseParse, TextModes } from './parse'
export {
  transform,
  TransformContext,
  createTransformContext,
  traverseNode,
  createStructuralDirectiveTransform,
  NodeTransform,
  StructuralDirectiveTransform,
  DirectiveTransform
} from './transform'
export { generate, CodegenContext, CodegenResult } from './codegen'
export {
  ErrorCodes,
  CoreCompilerError,
  CompilerError,
  createCompilerError
} from './errors'

export * from './ast'
export * from './utils'
export * from './runtimeHelpers'

export { getBaseTransformPreset, TransformPreset } from './compile'
export { transformModel } from './transforms/vModel'
export { transformOn } from './transforms/vOn'
export { transformBind } from './transforms/vBind'
export { noopDirectiveTransform } from './transforms/noopDirectiveTransform'
export { processIf } from './transforms/vIf'
export { processFor, createForLoopParams } from './transforms/vFor'
export {
  transformExpression,
  processExpression
} from './transforms/transformExpression'
export {
  buildSlots,
  SlotFnBuilder,
  trackVForSlotScopes,
  trackSlotScopes
} from './transforms/vSlot'
export { resolveComponentType, buildProps } from './transforms/transformElement'
export { processSlotOutlet } from './transforms/transformSlotOutlet'

// utility, but need to rewrite typing to avoid dts relying on @vue/shared
import { generateCodeFrame as _genCodeFrame } from '@vue/shared'
const generateCodeFrame = _genCodeFrame as (
  source: string,
  start?: number,
  end?: number
) => string
export { generateCodeFrame }
