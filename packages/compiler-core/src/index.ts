import { parse, ParserOptions } from './parse'
import { transform, TransformOptions } from './transform'
import { generate, CodegenOptions, CodegenResult } from './codegen'

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions

export function compile(
  template: string,
  options: CompilerOptions = {}
): CodegenResult {
  const ast = parse(template, options)

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
  Transform,
  DirectiveTransform
} from './transform'
export { generate, CodegenOptions, CodegenResult } from './codegen'
export { ErrorCodes, CompilerError, createCompilerError } from './errors'
export * from './ast'
