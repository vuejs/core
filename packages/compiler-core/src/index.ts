import { parse, ParserOptions } from './parse'
import { transform, TransformOptions } from './transform'
import { generate, CodegenOptions, CodegenResult } from './codegen'
import { RootNode } from './ast'
import { isString } from '@vue/shared'
import { transformIf } from './transforms/vIf'
import { transformFor } from './transforms/vFor'
import { transformExpression } from './transforms/transformExpression'
import { transformSlotOutlet } from './transforms/transformSlotOutlet'
import { transformElement } from './transforms/transformElement'
import { transformOn } from './transforms/vOn'
import { transformBind } from './transforms/vBind'
import { defaultOnError, createCompilerError, ErrorCodes } from './errors'
import { trackSlotScopes, trackVForSlotScopes } from './transforms/vSlot'
import { optimizeText } from './transforms/optimizeText'

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions

// we name it `baseCompile` so that higher order compilers like @vue/compiler-dom
// can export `compile` while re-exporting everything else.
export function baseCompile(
  template: string | RootNode,
  options: CompilerOptions = {}
): CodegenResult {
  /* istanbul ignore if */
  if (__BROWSER__) {
    const onError = options.onError || defaultOnError
    if (options.prefixIdentifiers === true) {
      onError(createCompilerError(ErrorCodes.X_PREFIX_ID_NOT_SUPPORTED))
    } else if (options.mode === 'module') {
      onError(createCompilerError(ErrorCodes.X_MODULE_MODE_NOT_SUPPORTED))
    }
  }

  const ast = isString(template) ? parse(template, options) : template

  const prefixIdentifiers =
    !__BROWSER__ &&
    (options.prefixIdentifiers === true || options.mode === 'module')

  transform(ast, {
    ...options,
    prefixIdentifiers,
    nodeTransforms: [
      transformIf,
      transformFor,
      ...(prefixIdentifiers
        ? [
            // order is important
            trackVForSlotScopes,
            transformExpression
          ]
        : []),
      trackSlotScopes,
      optimizeText,
      transformSlotOutlet,
      transformElement,
      ...(options.nodeTransforms || []) // user transforms
    ],
    directiveTransforms: {
      on: transformOn,
      bind: transformBind,
      ...(options.directiveTransforms || {}) // user transforms
    }
  })

  return generate(ast, {
    ...options,
    prefixIdentifiers
  })
}

// Also expose lower level APIs & types
export { parse, ParserOptions, TextModes } from './parse'
export {
  transform,
  createStructuralDirectiveTransform,
  TransformOptions,
  TransformContext,
  NodeTransform,
  StructuralDirectiveTransform
} from './transform'
export {
  generate,
  CodegenOptions,
  CodegenContext,
  CodegenResult
} from './codegen'
export { ErrorCodes, CompilerError, createCompilerError } from './errors'
export * from './ast'
