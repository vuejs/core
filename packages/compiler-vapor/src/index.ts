export { parse } from '@vue/compiler-dom'
export * from './transform'
export * from './generate'
export {
  wrapTemplate,
  compile,
  type CompilerOptions,
  type TransformPreset,
} from './compile'
export * from './ir'
export * from './errors'
export { transformElement } from './transforms/transformElement'
export { transformText } from './transforms/transformText'
export { transformVBind } from './transforms/vBind'
export { transformVHtml } from './transforms/vHtml'
export { transformVOn } from './transforms/vOn'
export { transformOnce } from './transforms/vOnce'
export { transformVShow } from './transforms/vShow'
export { transformVText } from './transforms/vText'
export { transformVIf } from './transforms/vIf'
export { transformVFor } from './transforms/vFor'
export { transformVModel } from './transforms/vModel'
