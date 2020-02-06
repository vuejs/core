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
        `null`, // fallback content placeholder.
        `_push`,
        `_parent`
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
  context.pushStatement(node.ssrCodegenNode!)
}
