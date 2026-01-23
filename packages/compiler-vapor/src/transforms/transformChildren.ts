import { type ElementNode, ElementTypes, NodeTypes } from '@vue/compiler-dom'
import {
  type NodeTransform,
  type TransformContext,
  transformNode,
} from '../transform'
import {
  DynamicFlag,
  type IRDynamicInfo,
  IRNodeTypes,
  type InsertionStateTypes,
  isBlockOperation,
} from '../ir'

export const transformChildren: NodeTransform = (node, context) => {
  const isFragment =
    node.type === NodeTypes.ROOT ||
    (node.type === NodeTypes.ELEMENT &&
      (node.tagType === ElementTypes.TEMPLATE ||
        node.tagType === ElementTypes.COMPONENT))

  if (!isFragment && node.type !== NodeTypes.ELEMENT) return

  for (const [i, child] of node.children.entries()) {
    const childContext = context.create(child, i)
    transformNode(childContext)

    const childDynamic = childContext.dynamic

    if (isFragment) {
      childContext.reference()
      childContext.registerTemplate()

      if (
        !(childDynamic.flags & DynamicFlag.NON_TEMPLATE) ||
        childDynamic.flags & DynamicFlag.INSERT
      ) {
        context.block.returns.push(childContext.dynamic.id!)
      }
    } else {
      context.childrenTemplate.push(childContext.template)
    }

    if (
      childDynamic.hasDynamicChild ||
      childDynamic.id !== undefined ||
      childDynamic.flags & DynamicFlag.NON_TEMPLATE ||
      childDynamic.flags & DynamicFlag.INSERT
    ) {
      context.dynamic.hasDynamicChild = true
    }

    context.dynamic.children[i] = childDynamic
  }

  if (!isFragment) {
    processDynamicChildren(context as TransformContext<ElementNode>)
  }
}

/**
 * Analyze a fragment-like element's dynamic children, assign logical indices for SSR hydration, and register insertion points or placeholder templates.
 *
 * Processes the array in `context.dynamic.children`, grouping INSERT dynamics and handling non-template children so that hydration indices and insertion operations are produced. As a result it may:
 * - set `logicalIndex`, `anchor`, `flags`, and `operation` fields on dynamic child entries;
 * - update `context.childrenTemplate` with placeholder templates where needed;
 * - register insertion operations/anchors via the transform `context`.
 * It also marks the final insertion operation as the last insertion when applicable.
 *
 * @param context - The element transform context whose dynamic children and templates will be mutated and whose operations/ids may be registered
 */
function processDynamicChildren(context: TransformContext<ElementNode>) {
  let prevDynamics: IRDynamicInfo[] = []
  let staticCount = 0
  let dynamicCount = 0
  let lastInsertionChild: IRDynamicInfo | undefined
  const children = context.dynamic.children

  // Track logical index for each child.
  // logicalIndex represents the position in SSR DOM, used during hydration
  // to locate the correct DOM node. Each child (static element, component,
  // v-if/v-else-if/v-else chain, v-for, slot) counts as one logical unit.
  let logicalIndex = 0

  for (const [index, child] of children.entries()) {
    if (child.flags & DynamicFlag.INSERT) {
      child.logicalIndex = logicalIndex
      prevDynamics.push((lastInsertionChild = child))
      logicalIndex++
    }

    if (!(child.flags & DynamicFlag.NON_TEMPLATE)) {
      child.logicalIndex = logicalIndex
      if (prevDynamics.length) {
        if (staticCount) {
          context.childrenTemplate[index - prevDynamics.length] = `<!>`
          prevDynamics[0].flags -= DynamicFlag.NON_TEMPLATE
          const anchor = (prevDynamics[0].anchor = context.increaseId())
          registerInsertion(prevDynamics, context, anchor)
        } else {
          registerInsertion(prevDynamics, context, -1 /* prepend */)
        }
        dynamicCount += prevDynamics.length
        prevDynamics = []
      }
      staticCount++
      logicalIndex++
    }
  }

  if (prevDynamics.length) {
    registerInsertion(
      prevDynamics,
      context,
      // the logical index of append child
      dynamicCount + staticCount,
      true,
    )
  }

  if (lastInsertionChild && lastInsertionChild.operation) {
    ;(lastInsertionChild.operation! as InsertionStateTypes).last = true
  }
}

/**
 * Apply insertion transformations for a group of dynamic children within a fragment-like transform context.
 *
 * Mutates each dynamic item by either registering an `INSERT_NODE` operation (for items with a `template`)
 * or updating the child's block operation fields (`parent`, `anchor`, `logicalIndex`, `append`) so the
 * operation is correctly anchored and ordered for SSR hydration and runtime insertion.
 *
 * @param dynamics - The dynamic children to register or update.
 * @param context - The transform context used to register operations and obtain the parent reference.
 * @param anchor - The numerical anchor index to use for anchoring insertions; special values (e.g. -1) indicate prepend semantics.
 * @param append - When true, treat the insertion as an append (do not set an explicit anchor on generated insert operations).
 */
function registerInsertion(
  dynamics: IRDynamicInfo[],
  context: TransformContext,
  anchor: number,
  append?: boolean,
) {
  for (const child of dynamics) {
    const logicalIndex = child.logicalIndex
    if (child.template != null) {
      // template node due to invalid nesting - generate actual insertion
      context.registerOperation({
        type: IRNodeTypes.INSERT_NODE,
        elements: dynamics.map(child => child.id!),
        parent: context.reference(),
        anchor: append ? undefined : anchor,
      })
    } else if (child.operation && isBlockOperation(child.operation)) {
      // block types
      child.operation.parent = context.reference()
      child.operation.anchor = anchor
      child.operation.logicalIndex = logicalIndex
      child.operation.append = append
    }
  }
}