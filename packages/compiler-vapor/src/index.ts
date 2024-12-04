export { parse } from '@vue/compiler-dom'
export {
  transform,
  createStructuralDirectiveTransform,
  type TransformContext,
  type NodeTransform,
  type StructuralDirectiveTransform,
  type DirectiveTransform,
} from './transform'
export {
  generate,
  type CodegenContext,
  type CodegenOptions,
  type VaporCodegenResult,
} from './generate'
export {
  genCall,
  genMulti,
  buildCodeFragment,
  codeFragmentToString,
  type CodeFragment,
} from './generators/utils'
export {
  wrapTemplate,
  compile,
  type CompilerOptions,
  type TransformPreset,
} from './compile'
export * from './ir'
export {
  VaporErrorCodes,
  VaporErrorMessages,
  createVaporCompilerError,
  type VaporCompilerError,
} from './errors'

export { transformElement } from './transforms/transformElement'
export { transformChildren } from './transforms/transformChildren'
export { transformTemplateRef } from './transforms/transformTemplateRef'
export { transformText } from './transforms/transformText'
export { transformVBind } from './transforms/vBind'
export { transformVHtml } from './transforms/vHtml'
export { transformVOn } from './transforms/vOn'
export { transformVOnce } from './transforms/vOnce'
export { transformVShow } from './transforms/vShow'
export { transformVText } from './transforms/vText'
export { transformVIf } from './transforms/vIf'
export { transformVFor } from './transforms/vFor'
export { transformVModel } from './transforms/vModel'
export { transformComment } from './transforms/transformComment'
export { transformSlotOutlet } from './transforms/transformSlotOutlet'
export { transformVSlot } from './transforms/vSlot'
