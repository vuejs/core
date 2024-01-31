import { NodeTypes, type SimpleExpressionNode } from '@vue/compiler-dom'
import type { NodeTransform } from '../transform'
import { DynamicFlag, IRNodeTypes } from '../ir'

export const transformInterpolation: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.INTERPOLATION) return

  const expr = node.content as SimpleExpressionNode
  const parentChildren = context.parent ? context.parent.node.children : []
  const isFirst = context.index === 0
  const isLast = context.index === parentChildren.length - 1
  const isRoot = context.parent === context.root

  if (isFirst && isLast && !isRoot) {
    const parent = context.parent!
    const parentId = parent.reference()
    context.registerEffect(
      [expr],
      [
        {
          type: IRNodeTypes.SET_TEXT,
          element: parentId,
          value: expr,
        },
      ],
    )
  } else {
    const id = context.reference()
    context.dynamic.flags |= DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE
    context.registerOperation({
      type: IRNodeTypes.CREATE_TEXT_NODE,
      id,
    })
    context.registerEffect(
      [expr],
      [
        {
          type: IRNodeTypes.SET_TEXT,
          element: id,
          value: expr,
        },
      ],
    )
  }
}
