import { parse, ParserOptions } from './parse'
import { transform, TransformOptions } from './transform'
import { generate, CodegenOptions, CodegenResult } from './codegen'
import { RootNode } from './ast'
import { isString } from '@vue/shared'
import { transformIf } from './transforms/vIf'
import { transformFor } from './transforms/vFor'
import { prepareElementForCodegen } from './transforms/element'
import { transformOn } from './transforms/vOn'
import { transformBind } from './transforms/vBind'
import { expressionTransform } from './transforms/expression'
import { defaultOnError, createCompilerError, ErrorCodes } from './errors'

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions

export function compile(
  template: string | RootNode,
  options: CompilerOptions = {}
): CodegenResult {
  const ast = isString(template) ? parse(template, options) : template
  const useWith = __BROWSER__ || options.useWith !== false

  if (__BROWSER__ && options.useWith === false) {
    ;(options.onError || defaultOnError)(
      createCompilerError(ErrorCodes.X_STRIP_WITH_NOT_SUPPORTED)
    )
  }

  transform(ast, {
    ...options,
    useWith,
    nodeTransforms: [
      transformIf,
      transformFor,
      ...(useWith ? [] : [expressionTransform]),
      prepareElementForCodegen,
      ...(options.nodeTransforms || []) // user transforms
    ],
    directiveTransforms: {
      on: transformOn,
      bind: transformBind,
      ...(options.directiveTransforms || {}) // user transforms
    }
  })
  return generate(ast, options)
}

// Also expose lower level APIs & types
export { parse, ParserOptions, TextModes } from './parse'
export {
  transform,
  createStructuralDirectiveTransform,
  TransformOptions,
  TransformContext,
  NodeTransform as Transform,
  StructuralDirectiveTransform
} from './transform'
export {
  generate,
  CodegenOptions,
  CodegenContext,
  CodegenResult
} from './codegen'
export { ErrorCodes, CompilerError, createCompilerError } from './errors'
export * from './ast'

// debug
export { prepareElementForCodegen } from './transforms/element'
