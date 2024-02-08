import {
  type AttributeNode,
  NodeTypes,
  type SimpleExpressionNode,
  createSimpleExpression,
  findProp,
} from '@vue/compiler-dom'
import { EMPTY_EXPRESSION, type NodeTransform } from '../transform'
import { IRNodeTypes, type VaporDirectiveNode } from '../ir'
import { normalizeBindShorthand } from './vBind'

export const transformRef: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT) return
  const dir = findProp(node, 'ref', false, true) as
    | VaporDirectiveNode
    | AttributeNode

  if (!dir) return

  let value: SimpleExpressionNode
  if (dir.type === NodeTypes.DIRECTIVE) {
    value = dir.exp || normalizeBindShorthand(dir.arg!, context)
  } else {
    value = dir.value
      ? createSimpleExpression(dir.value.content, true, dir.value.loc)
      : EMPTY_EXPRESSION
  }

  context.registerOperation({
    type: IRNodeTypes.SET_REF,
    element: context.reference(),
    value,
  })
}
