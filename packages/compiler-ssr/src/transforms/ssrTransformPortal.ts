import {
  ComponentNode,
  findProp,
  JSChildNode,
  NodeTypes,
  createSimpleExpression,
  createFunctionExpression,
  createCallExpression
} from '@vue/compiler-dom'
import {
  SSRTransformContext,
  processChildrenAsStatement
} from '../ssrCodegenTransform'
import { createSSRCompilerError, SSRErrorCodes } from '../errors'
import { SSR_RENDER_PORTAL } from '../runtimeHelpers'

// Note: this is a 2nd-pass codegen transform.
export function ssrProcessPortal(
  node: ComponentNode,
  context: SSRTransformContext
) {
  const targetProp = findProp(node, 'target')
  if (!targetProp) {
    context.onError(
      createSSRCompilerError(SSRErrorCodes.X_SSR_NO_PORTAL_TARGET, node.loc)
    )
    return
  }

  let target: JSChildNode
  if (targetProp.type === NodeTypes.ATTRIBUTE && targetProp.value) {
    target = createSimpleExpression(targetProp.value.content, true)
  } else if (targetProp.type === NodeTypes.DIRECTIVE && targetProp.exp) {
    target = targetProp.exp
  } else {
    context.onError(
      createSSRCompilerError(
        SSRErrorCodes.X_SSR_NO_PORTAL_TARGET,
        targetProp.loc
      )
    )
    return
  }

  const contentRenderFn = createFunctionExpression(
    [`_push`],
    undefined, // Body is added later
    true, // newline
    false, // isSlot
    node.loc
  )
  contentRenderFn.body = processChildrenAsStatement(node.children, context)
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_PORTAL), [
      `_push`,
      contentRenderFn,
      target,
      `_parent`
    ])
  )
}
