import {
  NodeTransform,
  NodeTypes,
  ElementTypes,
  createCallExpression,
  resolveComponentType,
  buildProps,
  ComponentNode,
  PORTAL,
  SUSPENSE,
  SlotFnBuilder,
  createFunctionExpression,
  createBlockStatement,
  buildSlots,
  FunctionExpression,
  TemplateChildNode
} from '@vue/compiler-dom'
import { SSR_RENDER_COMPONENT } from '../runtimeHelpers'
import {
  SSRTransformContext,
  createChildContext,
  processChildren
} from '../ssrCodegenTransform'
import { isSymbol } from '@vue/shared'

// We need to construct the slot functions in the 1st pass to ensure proper
// scope tracking, but the children of each slot cannot be processed until
// the 2nd pass, so we store the WIP slot functions in a weakmap during the 1st
// pass and complete them in the 2nd pass.
const wipMap = new WeakMap<ComponentNode, WIPSlotEntry[]>()

interface WIPSlotEntry {
  fn: FunctionExpression
  children: TemplateChildNode[]
}

export const ssrTransformComponent: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.COMPONENT
  ) {
    return
  }

  return function ssrPostTransformComponent() {
    const component = resolveComponentType(node, context)

    if (isSymbol(component)) {
      // built-in compoonent
      if (component === PORTAL) {
        // TODO
      } else if (component === SUSPENSE) {
        // TODO fallthrough
        // TODO option to use fallback content and resolve on client
      } else {
        // TODO fallthrough for KeepAlive & Transition
      }
    }

    // note we are not passing ssr: true here because for components, v-on
    // handlers should still be passed
    const props =
      node.props.length > 0 ? buildProps(node, context).props || `null` : `null`

    const wipEntries: WIPSlotEntry[] = []
    wipMap.set(node, wipEntries)

    const buildSSRSlotFn: SlotFnBuilder = (props, children, loc) => {
      // An SSR slot function has the signature of
      //   (props, _push, _parent) => void
      // See server-renderer/src/helpers/renderSlot.ts
      const fn = createFunctionExpression(
        [props || `_`, `_push`, `_parent`],
        undefined, // no return, assign body later
        true, // newline
        false, // isSlot: pass false since we don't need client scopeId codegen
        loc
      )
      wipEntries.push({ fn, children })
      return fn
    }

    const slots = node.children.length
      ? buildSlots(node, context, buildSSRSlotFn).slots
      : `null`

    // TODO option for slots bail out
    // TODO scopeId

    node.ssrCodegenNode = createCallExpression(
      context.helper(SSR_RENDER_COMPONENT),
      [component, props, slots, `_parent`]
    )
  }
}

export function ssrProcessComponent(
  node: ComponentNode,
  context: SSRTransformContext
) {
  // finish up slot function expressions from the 1st pass.
  const wipEntries = wipMap.get(node) || []
  for (let i = 0; i < wipEntries.length; i++) {
    const { fn, children } = wipEntries[i]
    const childContext = createChildContext(context)
    processChildren(children, childContext)
    fn.body = createBlockStatement(childContext.body)
  }
  context.pushStatement(node.ssrCodegenNode!)
}
