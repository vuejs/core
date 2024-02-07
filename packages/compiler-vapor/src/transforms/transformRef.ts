import {
  NodeTypes,
  type SimpleExpressionNode,
  findProp,
} from '@vue/compiler-dom'
import type { NodeTransform } from '../transform'
import { type IRExpression, IRNodeTypes } from '../ir'
import { normalizeBindShorthand } from './vBind'

export const transformRef: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT) return
  const dir = findProp(node, 'ref', false, true)

  if (!dir) return

  let value: IRExpression
  if (dir.type === NodeTypes.DIRECTIVE) {
    value =
      (dir.exp as SimpleExpressionNode | undefined) ||
      normalizeBindShorthand(dir.arg as SimpleExpressionNode, context)
  } else {
    value = dir.value ? JSON.stringify(dir.value.content) : '""'
  }

  context.registerOperation({
    type: IRNodeTypes.SET_REF,
    element: context.reference(),
    value,
  })
}
