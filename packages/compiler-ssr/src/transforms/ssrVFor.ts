import {
  createStructuralDirectiveTransform,
  ForNode,
  processForNode,
  createCallExpression,
  createFunctionExpression,
  createForLoopParams,
  createBlockStatement
} from '@vue/compiler-dom'
import {
  SSRTransformContext,
  createChildContext,
  processChildren
} from '../ssrCodegenTransform'
import { SSR_RENDER_LIST } from '../runtimeHelpers'

// Plugin for the first transform pass, which simply constructs the AST node
export const ssrTransformFor = createStructuralDirectiveTransform(
  'for',
  processForNode
)

// This is called during the 2nd transform pass to construct the SSR-sepcific
// codegen nodes.
export function processFor(node: ForNode, context: SSRTransformContext) {
  const renderLoop = createFunctionExpression(
    createForLoopParams(node.parseResult)
  )
  const childContext = createChildContext(context)
  processChildren(node.children, childContext)
  renderLoop.body = createBlockStatement(childContext.body)
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_LIST), [
      node.source,
      renderLoop
    ])
  )
}
