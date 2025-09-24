import {
  type CodegenResult,
  type CompilerOptions,
  type RootNode,
  baseParse,
  generate,
  noopDirectiveTransform,
  parserOptions,
  trackSlotScopes,
  trackVForSlotScopes,
  trackVScopeScopes,
  transform,
  transformBind,
  transformExpression,
  transformOn,
  transformStyle,
} from '@vue/compiler-dom'
import { ssrCodegenTransform } from './ssrCodegenTransform'
import { ssrTransformElement } from './transforms/ssrTransformElement'
import {
  rawOptionsMap,
  ssrTransformComponent,
} from './transforms/ssrTransformComponent'
import { ssrTransformSlotOutlet } from './transforms/ssrTransformSlotOutlet'
import { ssrTransformIf } from './transforms/ssrVIf'
import { ssrTransformFor } from './transforms/ssrVFor'
import { ssrTransformModel } from './transforms/ssrVModel'
import { ssrTransformShow } from './transforms/ssrVShow'
import { ssrInjectFallthroughAttrs } from './transforms/ssrInjectFallthroughAttrs'
import { ssrInjectCssVars } from './transforms/ssrInjectCssVars'

export function compile(
  source: string | RootNode,
  options: CompilerOptions = {},
): CodegenResult {
  options = {
    ...options,
    ...parserOptions,
    ssr: true,
    inSSR: true,
    scopeId: options.mode === 'function' ? null : options.scopeId,
    // always prefix since compiler-ssr doesn't have size concern
    prefixIdentifiers: true,
    // disable optimizations that are unnecessary for ssr
    cacheHandlers: false,
    hoistStatic: false,
  }

  const ast = typeof source === 'string' ? baseParse(source, options) : source

  // Save raw options for AST. This is needed when performing sub-transforms
  // on slot vnode branches.
  rawOptionsMap.set(ast, options)

  transform(ast, {
    ...options,
    hoistStatic: false,
    nodeTransforms: [
      ssrTransformIf,
      ssrTransformFor,
      trackVForSlotScopes,
      transformExpression,
      ssrTransformSlotOutlet,
      ssrInjectFallthroughAttrs,
      ssrInjectCssVars,
      ssrTransformElement,
      ssrTransformComponent,
      trackSlotScopes,
      trackVScopeScopes,
      transformStyle,
      ...(options.nodeTransforms || []), // user transforms
    ],
    directiveTransforms: {
      // reusing core v-bind
      bind: transformBind,
      on: transformOn,
      // model and show have dedicated SSR handling
      model: ssrTransformModel,
      show: ssrTransformShow,
      // the following are ignored during SSR
      // on: noopDirectiveTransform,
      cloak: noopDirectiveTransform,
      once: noopDirectiveTransform,
      memo: noopDirectiveTransform,
      ...(options.directiveTransforms || {}), // user transforms
    },
  })

  // traverse the template AST and convert into SSR codegen AST
  // by replacing ast.codegenNode.
  ssrCodegenTransform(ast, options)

  return generate(ast, options)
}
