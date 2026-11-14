import {
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type SlotOutletNode,
  TRANSITION,
  TRANSITION_GROUP,
  createCallExpression,
  createFunctionExpression,
  isSlotOutlet,
  processSlotOutlet,
  resolveComponentType,
} from '@vue/compiler-dom'
import {
  SSR_RENDER_SLOT,
  SSR_RENDER_SLOT_INNER,
  SSR_WITH_SLOT_CSS_VARS,
} from '../runtimeHelpers'
import {
  type SSRTransformContext,
  processChildrenAsStatement,
} from '../ssrCodegenTransform'
import { slotNeedsCssVars } from './ssrInjectCssVars'

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
      `_parent`,
    ]

    // inject slot scope id if current template uses :slotted
    if (context.scopeId && context.slotted !== false) {
      args.push(`"${context.scopeId}-s"`)
    }

    let method = SSR_RENDER_SLOT

    // #3989, #9933
    // check if this is a single slot inside a transition wrapper - since
    // transition/transition-group will unwrap the slot fragment into vnode(s)
    // at runtime, we need to avoid rendering the slot as a fragment.
    let parent = context.parent!
    if (parent) {
      const children = parent.children
      // #10743 <slot v-if> in <Transition>
      if (parent.type === NodeTypes.IF_BRANCH) {
        parent = context.grandParent!
      }
      let componentType
      if (
        parent.type === NodeTypes.ELEMENT &&
        parent.tagType === ElementTypes.COMPONENT &&
        ((componentType = resolveComponentType(parent, context, true)) ===
          TRANSITION ||
          componentType === TRANSITION_GROUP) &&
        children.filter(c => c.type === NodeTypes.ELEMENT).length === 1
      ) {
        method = SSR_RENDER_SLOT_INNER
        if (!(context.scopeId && context.slotted !== false)) {
          args.push('null')
        }
        args.push('true')
      }
    }

    node.ssrCodegenNode = createCallExpression(context.helper(method), args)
  }
}

export function ssrProcessSlotOutlet(
  node: SlotOutletNode,
  context: SSRTransformContext,
): void {
  const renderCall = node.ssrCodegenNode!

  // has fallback content
  if (node.children.length) {
    const fallbackRenderFn = createFunctionExpression([])
    fallbackRenderFn.body = processChildrenAsStatement(node, context)
    // _renderSlot(slots, name, props, fallback, ...)
    renderCall.arguments[3] = fallbackRenderFn
  }

  // A root `<slot>` is the component root. Props bound here never reach the
  // DOM, so the passed content has to carry the css vars at runtime.
  if (slotNeedsCssVars(node)) {
    renderCall.arguments[2] = createCallExpression(
      context.helper(SSR_WITH_SLOT_CSS_VARS),
      [renderCall.arguments[2] || `{}`, `_cssVars`],
    )
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
