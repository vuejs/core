import {
  type CompilerOptions as BaseCompilerOptions,
  ErrorCodes,
  type RootNode,
  createCompilerError,
  defaultOnError,
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
  const onError = options.onError || defaultOnError
  const isModuleMode = options.mode === 'module'
  /* istanbul ignore if */
  if (__BROWSER__) {
    if (options.prefixIdentifiers === true) {
      onError(createCompilerError(ErrorCodes.X_PREFIX_ID_NOT_SUPPORTED))
    } else if (isModuleMode) {
      onError(createCompilerError(ErrorCodes.X_MODULE_MODE_NOT_SUPPORTED))
    }
  }

  const prefixIdentifiers =
    !__BROWSER__ && (options.prefixIdentifiers === true || isModuleMode)

  if (options.scopeId && !isModuleMode) {
    onError(createCompilerError(ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED))
  }

  const resolvedOptions = extend({}, options, {
    prefixIdentifiers,
  })
  const ast = isString(source) ? parse(source, resolvedOptions) : source
  const [nodeTransforms, directiveTransforms] =
    getBaseTransformPreset(prefixIdentifiers)

  if (!__BROWSER__ && options.isTS) {
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

export function getBaseTransformPreset(
  prefixIdentifiers?: boolean,
): TransformPreset {
  return [
    [
      transformVOnce,
      transformVIf,
      transformVFor,
      transformSlotOutlet,
      transformTemplateRef,
      transformText,
      transformElement,
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
