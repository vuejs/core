import {
  type CodegenResult,
  type CompilerOptions as BaseCompilerOptions,
  type RootNode,
  type DirectiveTransform,
  parse,
  defaultOnError,
  createCompilerError,
  ErrorCodes,
} from '@vue/compiler-dom'
import { extend, isString } from '@vue/shared'
import { NodeTransform, transform } from './transform'
import { generate } from './generate'
import { transformOnce } from './transforms/vOnce'
import { HackOptions } from './hack'

export type CompilerOptions = HackOptions<BaseCompilerOptions>

// TODO: copied from @vue/compiler-core
// code/AST -> IR -> JS codegen
export function compile(
  source: string | RootNode,
  options: CompilerOptions = {},
): CodegenResult {
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

  // TODO scope id
  // if (options.scopeId && !isModuleMode) {
  //   onError(createCompilerError(ErrorCodes.X_SCOPE_ID_NOT_SUPPORTED))
  // }

  const ast = isString(source) ? parse(source, options) : source
  const [nodeTransforms, directiveTransforms] =
    getBaseTransformPreset(prefixIdentifiers)

  if (!__BROWSER__ && options.isTS) {
    const { expressionPlugins } = options
    if (!expressionPlugins || !expressionPlugins.includes('typescript')) {
      options.expressionPlugins = [...(expressionPlugins || []), 'typescript']
    }
  }

  const ir = transform(
    ast,
    extend({}, options, {
      prefixIdentifiers,
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

  return generate(
    ir,
    extend({}, options, {
      prefixIdentifiers,
    }),
  )
}

export type TransformPreset = [
  NodeTransform[],
  Record<string, DirectiveTransform>,
]

export function getBaseTransformPreset(
  prefixIdentifiers?: boolean,
): TransformPreset {
  return [[transformOnce], {}]
}
