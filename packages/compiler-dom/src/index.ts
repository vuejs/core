import { baseCompile, CompilerOptions, CodegenResult } from '@vue/compiler-core'
import { parserOptionsMinimal } from './parserOptionsMinimal'
import { parserOptionsStandard } from './parserOptionsStandard'
import { transformStyle } from './transforms/transformStyle'
import { transformCloak } from './transforms/vCloak'
import { transformVHtml } from './transforms/vHtml'
import { transformVText } from './transforms/vText'
import { transformModel } from './transforms/vModel'
import { transformOn } from './transforms/vOn'

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
      text: transformVText,
      model: transformModel, // override compiler-core
      on: transformOn,
      ...(options.directiveTransforms || {})
    }
  })
}

export * from '@vue/compiler-core'
export * from './tagConfig'
