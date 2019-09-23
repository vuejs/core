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
import { rewriteExpression } from './transforms/expression'

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions

export function compile(
  template: string | RootNode,
  options: CompilerOptions = {}
): CodegenResult {
  const ast = isString(template) ? parse(template, options) : template

  transform(ast, {
    ...options,
    nodeTransforms: [
      ...(!__BROWSER__ && options.useWith === false ? [rewriteExpression] : []),
      transformIf,
      transformFor,
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
