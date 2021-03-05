import {
  NodeTransform,
  isSlotOutlet,
  processSlotOutlet,
  createCallExpression,
  SlotOutletNode,
  createFunctionExpression
} from '@vue/compiler-dom'
import { SSR_RENDER_SLOT } from '../runtimeHelpers'
import {
  SSRTransformContext,
  processChildrenAsStatement
} from '../ssrCodegenTransform'

export const ssrTransformSlotOutlet: NodeTransform = (node, context) => {
  if (isSlotOutlet(node)) {
    const { slotName, slotProps } = processSlotOutlet(node, context)
    node.ssrCodegenNode = createCallExpression(
      context.helper(SSR_RENDER_SLOT),
      [
        `_ctx.$slots`,
        slotName,
        slotProps || `{}`,
        // fallback content placeholder. will be replaced in the process phase
        `null`,
        `_push`,
        `_parent`,
        context.scopeId ? `"${context.scopeId}-s"` : `null`
      ]
    )
  }
}

export function ssrProcessSlotOutlet(
  node: SlotOutletNode,
  context: SSRTransformContext
) {
  const renderCall = node.ssrCodegenNode!

  // has fallback content
  if (node.children.length) {
    const fallbackRenderFn = createFunctionExpression([])
    fallbackRenderFn.body = processChildrenAsStatement(node.children, context)
    // _renderSlot(slots, name, props, fallback, ...)
    renderCall.arguments[3] = fallbackRenderFn
  }

  // Forwarded <slot/>. Add slot scope id
  if (context.withSlotScopeId) {
    const scopeId = renderCall.arguments[6] as string
    renderCall.arguments[6] =
      scopeId === `null` ? `_scopeId` : `${scopeId} + _scopeId`
  }

  context.pushStatement(node.ssrCodegenNode!)
}
