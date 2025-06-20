import {
  type CompilerOptions as BaseCompilerOptions,
  type RootNode,
  parse,
} from '@vue/compiler-dom'
import { extend, isString } from '@vue/shared'
import {
  type DirectiveTransform,
  type NodeTransform,
  transform,
} from './transform'
import { type VaporCodegenResult, generate } from './generate'
import { transformChildren } from './transforms/transformChildren'
import { transformVOnce } from './transforms/vOnce'
import { transformElement } from './transforms/transformElement'
import { transformVHtml } from './transforms/vHtml'
import { transformVText } from './transforms/vText'
import { transformVBind } from './transforms/vBind'
import { transformVOn } from './transforms/vOn'
import { transformVShow } from './transforms/vShow'
import { transformTemplateRef } from './transforms/transformTemplateRef'
import { transformText } from './transforms/transformText'
import { transformVModel } from './transforms/vModel'
import { transformVIf } from './transforms/vIf'
import { transformVFor } from './transforms/vFor'
import { transformComment } from './transforms/transformComment'
import { transformSlotOutlet } from './transforms/transformSlotOutlet'
import { transformVSlot } from './transforms/vSlot'
import type { HackOptions } from './ir'

export { wrapTemplate } from './transforms/utils'

// code/AST -> IR (transform) -> JS (generate)
export function compile(
  source: string | RootNode,
  options: CompilerOptions = {},
): VaporCodegenResult {
  const resolvedOptions = extend({}, options)
  const ast = isString(source) ? parse(source, resolvedOptions) : source
  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset()

  if (options.isTS) {
    const { expressionPlugins } = options
    if (!expressionPlugins || !expressionPlugins.includes('typescript')) {
      resolvedOptions.expressionPlugins = [
        ...(expressionPlugins || []),
        'typescript',
      ]
    }
  }

  const ir = transform(
    ast,
    extend({}, resolvedOptions, {
      nodeTransforms: [
        ...nodeTransforms,
        ...(options.nodeTransforms || []), // user transforms
      ],
      directiveTransforms: extend(
        {},
        directiveTransforms,
        options.directiveTransforms || {}, // user transforms
      ),
    }),
  )

  return generate(ir, resolvedOptions)
}

export type CompilerOptions = HackOptions<BaseCompilerOptions>
export type TransformPreset = [
  NodeTransform[],
  Record<string, DirectiveTransform>,
]

export function getBaseTransformPreset(): TransformPreset {
  return [
    [
      transformVOnce,
      transformVIf,
      transformVFor,
      transformSlotOutlet,
      transformTemplateRef,
      transformElement,
      transformText,
      transformVSlot,
      transformComment,
      transformChildren,
    ],
    {
      bind: transformVBind,
      on: transformVOn,
      html: transformVHtml,
      text: transformVText,
      show: transformVShow,
      model: transformVModel,
    },
  ]
}
