export { baseCompile } from './compile'

// Also expose lower level APIs & types
export {
  CompilerOptions,
  ParserOptions,
  TransformOptions,
  CodegenOptions
} from './options'
export { baseParse, TextModes } from './parse'
export {
  transform,
  createStructuralDirectiveTransform,
  TransformContext,
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
export { registerRuntimeHelpers } from './runtimeHelpers'

// expose transforms so higher-order compilers can import and extend them
export { transformModel } from './transforms/vModel'
export { transformOn } from './transforms/vOn'

// utility, but need to rewrite typing to avoid dts relying on @vue/shared
import { generateCodeFrame as _genCodeFrame } from '@vue/shared'
const generateCodeFrame = _genCodeFrame as (
  source: string,
  start?: number,
  end?: number
) => string
export { generateCodeFrame }
