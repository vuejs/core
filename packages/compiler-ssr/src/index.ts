import {
  CodegenResult,
  baseParse,
  parserOptions,
  transform,
  generate,
  CompilerOptions,
  transformExpression,
  trackVForSlotScopes,
  trackSlotScopes
} from '@vue/compiler-dom'
import { ssrCodegenTransform } from './ssrCodegenTransform'
import { ssrTransformIf } from './transforms/ssrVIf'
import { ssrTransformFor } from './transforms/ssrVFor'
import { ssrTransformElement } from './transforms/ssrTransformElement'
import { ssrTransformComponent } from './transforms/ssrTransformComponent'
import { ssrTransformSlotOutlet } from './transforms/ssrTransformSlotOutlet'

export interface SSRCompilerOptions extends CompilerOptions {}

export function compile(
  template: string,
  options: SSRCompilerOptions = {}
): CodegenResult {
  // apply DOM-specific parsing options
  options = {
    ...parserOptions,
    ...options
  }

  const ast = baseParse(template, options)

  transform(ast, {
    ...options,
    prefixIdentifiers: true,
    // disalbe optimizations that are unnecessary for ssr
    cacheHandlers: false,
    hoistStatic: false,
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
    directiveTransforms: {
      // TODO server-side directive transforms
      ...(options.directiveTransforms || {}) // user transforms
    }
  })

  // traverse the template AST and convert into SSR codegen AST
  // by replacing ast.codegenNode.
  ssrCodegenTransform(ast, options)

  return generate(ast, {
    mode: 'cjs',
    ...options,
    ssr: true,
    prefixIdentifiers: true
  })
}
