import {
  CodegenResult,
  baseParse,
  parserOptions,
  transform,
  generate,
  CompilerOptions,
  transformExpression,
  trackVForSlotScopes,
  trackSlotScopes,
  noopDirectiveTransform
} from '@vue/compiler-dom'
import { ssrCodegenTransform } from './ssrCodegenTransform'
import { ssrTransformElement } from './transforms/ssrTransformElement'
import { ssrTransformComponent } from './transforms/ssrTransformComponent'
import { ssrTransformSlotOutlet } from './transforms/ssrTransformSlotOutlet'
import { ssrTransformIf } from './transforms/ssrVIf'
import { ssrTransformFor } from './transforms/ssrVFor'
import { ssrVBind } from './transforms/ssrVBind'
import { ssrVModel } from './transforms/ssrVModel'
import { ssrVShow } from './transforms/ssrVShow'

export function compile(
  template: string,
  options: CompilerOptions = {}
): CodegenResult {
  options = {
    mode: 'cjs',
    ...options,
    // apply DOM-specific parsing options
    ...parserOptions,
    ssr: true,
    // always prefix since compiler-ssr doesn't have size concern
    prefixIdentifiers: true,
    // disalbe optimizations that are unnecessary for ssr
    cacheHandlers: false,
    hoistStatic: false
  }

  const ast = baseParse(template, options)

  transform(ast, {
    ...options,
    nodeTransforms: [
      ssrTransformIf,
      ssrTransformFor,
      trackVForSlotScopes,
      transformExpression,
      ssrTransformSlotOutlet,
      ssrTransformElement,
      ssrTransformComponent,
      trackSlotScopes,
      ...(options.nodeTransforms || []) // user transforms
    ],
    ssrDirectiveTransforms: {
      on: noopDirectiveTransform,
      cloak: noopDirectiveTransform,
      bind: ssrVBind,
      model: ssrVModel,
      show: ssrVShow,
      ...(options.ssrDirectiveTransforms || {}) // user transforms
    }
  })

  // traverse the template AST and convert into SSR codegen AST
  // by replacing ast.codegenNode.
  ssrCodegenTransform(ast, options)

  return generate(ast, options)
}
