import {
  parse,
  transform,
  generate,
  CompilerError,
  Transform,
  CodegenResult
} from '@vue/compiler-core'
import { parserOptionsMinimal } from './parserOptionsMinimal'
import { parserOptionsStandard } from './parserOptionsStandard'

const parserOptions = __BROWSER__ ? parserOptionsMinimal : parserOptionsStandard

export interface CompilerOptions {
  module?: boolean
  onError?(err: CompilerError): void
  transforms?: Transform[]
}

export function compile(
  template: string,
  options: CompilerOptions = {}
): CodegenResult {
  const {
    module = false,
    onError = (err: CompilerError) => {
      throw err
    },
    transforms = []
  } = options
  const ast = parse(template, {
    ...parserOptions,
    onError
  })
  transform(ast, {
    transforms: [
      // TODO include core transforms
      // TODO include DOM transforms
      ...transforms // user transforms
    ],
    onError
  })
  return generate(ast, { module })
}

export * from '@vue/compiler-core'
