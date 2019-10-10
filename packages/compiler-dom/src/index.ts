import { baseCompile, CompilerOptions, CodegenResult } from '@vue/compiler-core'
import { parserOptionsMinimal } from './parserOptionsMinimal'
import { parserOptionsStandard } from './parserOptionsStandard'
import { transformStyle } from './transforms/transformStyle'
import { transformCloak } from './transforms/vCloak'
import { transformVHtml } from './transforms/vHtml'

export function compile(
  template: string,
  options: CompilerOptions = {}
): CodegenResult {
  return baseCompile(template, {
    ...options,
    ...(__BROWSER__ ? parserOptionsMinimal : parserOptionsStandard),
    nodeTransforms: [transformStyle, ...(options.nodeTransforms || [])],
    directiveTransforms: {
      cloak: transformCloak,
      html: transformVHtml,
      ...(options.directiveTransforms || {})
    }
  })
}

export * from '@vue/compiler-core'
