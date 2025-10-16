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

function processDynamicChildren(context: TransformContext<ElementNode>) {
  let prevDynamics: IRDynamicInfo[] = []
  let staticCount = 0
  let dynamicCount = 0
  let lastInsertionChild: IRDynamicInfo | undefined
  const children = context.dynamic.children

  for (const [index, child] of children.entries()) {
    if (child.flags & DynamicFlag.INSERT) {
      prevDynamics.push((lastInsertionChild = child))
    }

    if (!(child.flags & DynamicFlag.NON_TEMPLATE)) {
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

function registerInsertion(
  dynamics: IRDynamicInfo[],
  context: TransformContext,
  anchor: number,
  append?: boolean,
) {
  for (const child of dynamics) {
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
      child.operation.append = append
    }
  }
}
