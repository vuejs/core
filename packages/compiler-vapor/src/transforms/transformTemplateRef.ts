import {
  ElementTypes,
  NodeTypes,
  type SimpleExpressionNode,
  createSimpleExpression,
} from '@vue/compiler-dom'
import type { NodeTransform } from '../transform'
import { IRNodeTypes } from '../ir'
import { normalizeBindShorthand } from './vBind'
import { findProp, isComponentTag, isConstantExpression } from '../utils'
import { EMPTY_EXPRESSION } from './utils'

export const transformTemplateRef: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT) return

  const dir = findProp(node, 'ref', false, true)
  if (!dir) {
    // #10696 a ref inside v-bind="obj" is only known at runtime
    if (
      node.tagType === ElementTypes.COMPONENT &&
      // a dynamic component renders a fragment, not the component itself
      !isComponentTag(node.tag) &&
      node.props.some(
        prop =>
          prop.type === NodeTypes.DIRECTIVE &&
          prop.name === 'bind' &&
          !prop.arg &&
          prop.exp,
      )
    ) {
      return () => {
        context.registerOperation({
          type: IRNodeTypes.SET_TEMPLATE_REF,
          element: context.reference(),
          value: EMPTY_EXPRESSION,
          refFor: !!context.inVFor,
          effect: false,
          fromProps: true,
        })
      }
    }
    return
  }

  context.ir.hasTemplateRef = true

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
    const effect = !isConstantExpression(value, context.options.bindingMetadata)
    context.registerEffect([value], {
      type: IRNodeTypes.SET_TEMPLATE_REF,
      element: id,
      value,
      refFor: !!context.inVFor,
      effect,
    })
  }
}
