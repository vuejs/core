import {
  baseCompile,
  baseParse,
  CompilerOptions,
  CodegenResult,
  ParserOptions,
  RootNode,
  noopDirectiveTransform,
  TransformPreset,
  getBaseTransformPreset
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

export function getDOMTransformPreset(
  prefixIdentifiers?: boolean
): TransformPreset {
  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset(
    prefixIdentifiers
  )
  return [
    [
      ...nodeTransforms,
      transformStyle,
      ...(__DEV__ ? [warnTransitionChildren] : [])
    ],
    {
      ...directiveTransforms,
      cloak: noopDirectiveTransform,
      html: transformVHtml,
      text: transformVText,
      model: transformModel, // override compiler-core
      on: transformOn, // override compiler-core
      show: transformShow
    }
  ]
}

export function compile(
  template: string,
  options: CompilerOptions = {}
): CodegenResult {
  const [nodeTransforms, directiveTransforms] = getDOMTransformPreset(
    options.prefixIdentifiers
  )
  return baseCompile(template, {
    ...parserOptions,
    ...options,
    nodeTransforms: [...nodeTransforms, ...(options.nodeTransforms || [])],
    directiveTransforms: {
      ...directiveTransforms,
      ...(options.directiveTransforms || {})
    }
  })
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
