import {
  compile as baseCompile,
  CompilerOptions,
  CodegenResult
} from '@vue/compiler-core'
import { parserOptionsMinimal } from './parserOptionsMinimal'
import { parserOptionsStandard } from './parserOptionsStandard'

export function compile(
  template: string,
  options: CompilerOptions = {}
): CodegenResult {
  return baseCompile(template, {
    ...options,
    ...(__BROWSER__ ? parserOptionsMinimal : parserOptionsStandard),
    transforms: [
      // TODO include DOM-specific transforms
      ...(options.transforms || []) // extra user transforms
    ]
  })
}

export * from '@vue/compiler-core'
