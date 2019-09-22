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
    directiveTransforms: {
      // TODO include DOM-specific directiveTransforms
      ...(options.directiveTransforms || {})
    }
  })
}

export * from '@vue/compiler-core'
