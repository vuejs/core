import {
  baseCompile,
  baseParse,
  CompilerOptions,
  CodegenResult,
  ParserOptions,
  RootNode,
  noopDirectiveTransform,
  NodeTransform,
  DirectiveTransform
} from '@vue/compiler-core'
import { parserOptionsMinimal } from './parserOptionsMinimal'
import { parserOptionsStandard } from './parserOptionsStandard'
import { transformStyle } from './transforms/transformStyle'
import { transformVHtml } from './transforms/vHtml'
import { transformVText } from './transforms/vText'
import { transformModel } from './transforms/vModel'
import { transformOn } from './transforms/vOn'
import { transformShow } from './transforms/vShow'
import { warnTransitionChildren } from './transforms/warnTransitionChildren'

export const parserOptions = __BROWSER__
  ? parserOptionsMinimal
  : parserOptionsStandard

export const DOMNodeTransforms: NodeTransform[] = [
  transformStyle,
  ...(__DEV__ ? [warnTransitionChildren] : [])
]

export const DOMDirectiveTransforms: Record<string, DirectiveTransform> = {
  cloak: noopDirectiveTransform,
  html: transformVHtml,
  text: transformVText,
  model: transformModel, // override compiler-core
  on: transformOn, // override compiler-core
  show: transformShow
}

export function compile(
  template: string,
  options: CompilerOptions = {}
): CodegenResult {
  const result = baseCompile(template, {
    ...parserOptions,
    ...options,
    nodeTransforms: [...DOMNodeTransforms, ...(options.nodeTransforms || [])],
    directiveTransforms: {
      ...DOMDirectiveTransforms,
      ...(options.directiveTransforms || {})
    }
  })
  // debugger
  return result
}

export function parse(template: string, options: ParserOptions = {}): RootNode {
  return baseParse(template, {
    ...parserOptions,
    ...options
  })
}

export * from './runtimeHelpers'
export { transformStyle } from './transforms/transformStyle'
export { createDOMCompilerError, DOMErrorCodes } from './errors'
export * from '@vue/compiler-core'
