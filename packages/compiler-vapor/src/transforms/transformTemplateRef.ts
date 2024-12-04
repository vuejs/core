import {
  NodeTypes,
  type SimpleExpressionNode,
  createSimpleExpression,
} from '@vue/compiler-dom'
import type { NodeTransform } from '../transform'
import { IRNodeTypes } from '../ir'
import { normalizeBindShorthand } from './vBind'
import { findProp, isConstantExpression } from '../utils'
import { EMPTY_EXPRESSION } from './utils'

export const transformTemplateRef: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT) return

  const dir = findProp(node, 'ref', false, true)
  if (!dir) return

  let value: SimpleExpressionNode
  if (dir.type === NodeTypes.DIRECTIVE) {
    value = dir.exp || normalizeBindShorthand(dir.arg!, context)
  } else {
    value = dir.value
      ? createSimpleExpression(dir.value.content, true, dir.value.loc)
      : EMPTY_EXPRESSION
  }

  return () => {
    const id = context.reference()
    const effect = !isConstantExpression(value)
    effect &&
      context.registerOperation({
        type: IRNodeTypes.DECLARE_OLD_REF,
        id,
      })
    context.registerEffect([value], {
      type: IRNodeTypes.SET_TEMPLATE_REF,
      element: id,
      value,
      refFor: !!context.inVFor,
      effect,
    })
  }
}
