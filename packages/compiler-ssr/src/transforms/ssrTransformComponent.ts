import {
  NodeTransform,
  NodeTypes,
  ElementTypes,
  createCallExpression,
  resolveComponentType,
  buildProps,
  ComponentNode,
  SlotFnBuilder,
  createFunctionExpression,
  createBlockStatement,
  buildSlots,
  FunctionExpression,
  TemplateChildNode,
  PORTAL,
  SUSPENSE,
  TRANSITION_GROUP,
  createIfStatement,
  createSimpleExpression,
  isText
} from '@vue/compiler-dom'
import { SSR_RENDER_COMPONENT } from '../runtimeHelpers'
import {
  SSRTransformContext,
  processChildren,
  processChildrenAsStatement
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

const componentTypeMap = new WeakMap<ComponentNode, symbol>()

export const ssrTransformComponent: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.COMPONENT
  ) {
    return
  }

  return function ssrPostTransformComponent() {
    const component = resolveComponentType(node, context, true /* ssr */)
    if (isSymbol(component)) {
      componentTypeMap.set(node, component)
      return // built-in component: fallthrough
    }

    // note we are not passing ssr: true here because for components, v-on
    // handlers should still be passed
    const props =
      node.props.length > 0 ? buildProps(node, context).props || `null` : `null`

    const wipEntries: WIPSlotEntry[] = []
    wipMap.set(node, wipEntries)

    const buildSSRSlotFn: SlotFnBuilder = (props, children, loc) => {
      // An SSR slot function has the signature of
      //   (props, _push, _parent, _scopeId) => void
      // See server-renderer/src/helpers/renderSlot.ts
      const fn = createFunctionExpression(
        [props || `_`, `_push`, `_parent`, `_scopeId`],
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
  if (!node.ssrCodegenNode) {
    // this is a built-in component that fell-through.
    // just render its children.
    const component = componentTypeMap.get(node)!

    if (component === PORTAL) {
      // TODO
      return
    }

    const needFragmentWrapper =
      component === SUSPENSE || component === TRANSITION_GROUP
    processChildren(node.children, context, needFragmentWrapper)
  } else {
    // finish up slot function expressions from the 1st pass.
    const wipEntries = wipMap.get(node) || []
    for (let i = 0; i < wipEntries.length; i++) {
      const { fn, children } = wipEntries[i]
      const hasNonTextChild = children.some(c => !isText(c))
      if (hasNonTextChild) {
        // SSR slots need to handled potential presence of scopeId of the child
        // component. To avoid the cost of concatenation when it's unnecessary,
        // we split the code into two paths, one with slot scopeId and one without.
        fn.body = createBlockStatement([
          createIfStatement(
            createSimpleExpression(`_scopeId`, false),
            // branch with scopeId concatenation
            processChildrenAsStatement(children, context, false, true),
            // branch without scopeId concatenation
            processChildrenAsStatement(children, context, false, false)
          )
        ])
      } else {
        // only text, no need for scopeId branching.
        fn.body = processChildrenAsStatement(children, context)
      }
    }
    context.pushStatement(createCallExpression(`_push`, [node.ssrCodegenNode]))
  }
}
