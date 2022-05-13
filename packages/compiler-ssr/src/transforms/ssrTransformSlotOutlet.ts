import {
  NodeTransform,
  isSlotOutlet,
  processSlotOutlet,
  createCallExpression,
  SlotOutletNode,
  createFunctionExpression,
  NodeTypes,
  ElementTypes,
  resolveComponentType,
  TRANSITION
} from '@vue/compiler-dom'
import { SSR_RENDER_SLOT, SSR_RENDER_SLOT_INNER } from '../runtimeHelpers'
import {
  SSRTransformContext,
  processChildrenAsStatement
} from '../ssrCodegenTransform'

export const ssrTransformSlotOutlet: NodeTransform = (node, context) => {
  if (isSlotOutlet(node)) {
    const { slotName, slotProps } = processSlotOutlet(node, context)

    const args = [
      `_ctx.$slots`,
      slotName,
      slotProps || `{}`,
      // fallback content placeholder. will be replaced in the process phase
      `null`,
      `_push`,
      `_parent`
    ]

    // inject slot scope id if current template uses :slotted
    if (context.scopeId && context.slotted !== false) {
      args.push(`"${context.scopeId}-s"`)
    }

    let method = SSR_RENDER_SLOT

    // #3989
    // check if this is a single slot inside a transition wrapper - since
    // transition will unwrap the slot fragment into a single vnode at runtime,
    // we need to avoid rendering the slot as a fragment.
    const parent = context.parent
    if (
      parent &&
      parent.type === NodeTypes.ELEMENT &&
      parent.tagType === ElementTypes.COMPONENT &&
      resolveComponentType(parent, context, true) === TRANSITION &&
      parent.children.filter(c => c.type === NodeTypes.ELEMENT).length === 1
    ) {
      method = SSR_RENDER_SLOT_INNER
    }

    node.ssrCodegenNode = createCallExpression(context.helper(method), args)
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

  // Forwarded <slot/>. Merge slot scope ids
  if (context.withSlotScopeId) {
    const slotScopeId = renderCall.arguments[6]
    renderCall.arguments[6] = slotScopeId
      ? `${slotScopeId as string} + _scopeId`
      : `_scopeId`
  }

  context.pushStatement(node.ssrCodegenNode!)
}
