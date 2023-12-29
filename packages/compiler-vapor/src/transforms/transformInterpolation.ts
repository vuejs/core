import { NodeTypes, type SimpleExpressionNode } from '@vue/compiler-dom'
import type { NodeTransform } from '../transform'
import { IRNodeTypes } from '../ir'

export const transformInterpolation: NodeTransform = (node, ctx) => {
  if (node.type !== NodeTypes.INTERPOLATION) return

  const expr = node.content as SimpleExpressionNode
  const parentChildren = ctx.parent ? ctx.parent.node.children : []
  const isFirst = ctx.index === 0
  const isLast = ctx.index === parentChildren.length - 1

  if (isFirst && isLast) {
    const parent = ctx.parent!
    const parentId = parent.reference()
    ctx.registerEffect(
      [expr],
      [
        {
          type: IRNodeTypes.SET_TEXT,
          loc: node.loc,
          element: parentId,
          value: expr,
        },
      ],
    )
  } else {
    const id = ctx.reference()
    ctx.dynamic.ghost = true
    ctx.registerOperation({
      type: IRNodeTypes.CREATE_TEXT_NODE,
      loc: node.loc,
      id,
      value: expr,
    })
    ctx.registerEffect(
      [expr],
      [
        {
          type: IRNodeTypes.SET_TEXT,
          loc: node.loc,
          element: id,
          value: expr,
        },
      ],
    )
  }
}
