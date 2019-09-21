import { parse, ParserOptions } from './parse'
import { transform, TransformOptions } from './transform'
import { generate, CodegenOptions, CodegenResult } from './codegen'
import { RootNode } from './ast'
import { isString } from '@vue/shared'

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions

export function compile(
  template: string | RootNode,
  options: CompilerOptions = {}
): CodegenResult {
  const ast = isString(template) ? parse(template, options) : template

  transform(ast, {
    ...options,
    transforms: [
      // TODO include built-in core transforms
      ...(options.transforms || []) // user transforms
    ]
  })

  return generate(ast, options)
}

// Also expose lower level APIs & types
export { parse, ParserOptions, TextModes } from './parse'
export {
  transform,
  createDirectiveTransform,
  TransformOptions,
  TransformContext,
  Transform,
  DirectiveTransform
} from './transform'
export {
  generate,
  CodegenOptions,
  CodegenContext,
  CodegenResult
} from './codegen'
export { ErrorCodes, CompilerError, createCompilerError } from './errors'
export * from './ast'
