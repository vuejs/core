import {
  type ComponentNode,
  type FunctionExpression,
  type SlotsExpression,
  type TemplateChildNode,
  type TransformContext,
  buildSlots,
  createCallExpression,
  createFunctionExpression,
} from '@vue/compiler-dom'
import {
  type SSRTransformContext,
  processChildrenAsStatement,
} from '../ssrCodegenTransform'
import { SSR_RENDER_SUSPENSE } from '../runtimeHelpers'

const wipMap = new WeakMap<ComponentNode, WIPEntry>()

interface WIPEntry {
  slotsExp: SlotsExpression
  wipSlots: Array<{
    fn: FunctionExpression
    children: TemplateChildNode[]
  }>
}

// phase 1
export function ssrTransformSuspense(
  node: ComponentNode,
  context: TransformContext,
) {
  return (): void => {
    if (node.children.length) {
      const wipEntry: WIPEntry = {
        slotsExp: null!, // to be immediately set
        wipSlots: [],
      }
      wipMap.set(node, wipEntry)
      wipEntry.slotsExp = buildSlots(
        node,
        context,
        (_props, _vForExp, children, loc) => {
          const fn = createFunctionExpression(
            [],
            undefined, // no return, assign body later
            true, // newline
            false, // suspense slots are not treated as normal slots
            loc,
          )
          wipEntry.wipSlots.push({
            fn,
            children,
          })
          return fn
        },
      ).slots
    }
  }
}

// phase 2
export function ssrProcessSuspense(
  node: ComponentNode,
  context: SSRTransformContext,
): void {
  // complete wip slots with ssr code
  const wipEntry = wipMap.get(node)
  if (!wipEntry) {
    return
  }
  const { slotsExp, wipSlots } = wipEntry
  for (let i = 0; i < wipSlots.length; i++) {
    const slot = wipSlots[i]
    slot.fn.body = processChildrenAsStatement(slot, context)
  }
  // _push(ssrRenderSuspense(slots))
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_SUSPENSE), [
      `_push`,
      slotsExp,
    ]),
  )
}
