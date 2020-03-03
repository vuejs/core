import { NodeTransform } from '../transform'
import {
  NodeTypes,
  ElementTypes,
  createSimpleExpression,
  createCompoundExpression
} from '../ast'
import { findProp } from '../utils'

// Convert ref="foo" to `:ref="[_ctx, 'foo']"` so that the ref contains the
// correct owner instance even inside slots.
export const transformRef: NodeTransform = node => {
  if (
    !(
      node.type === NodeTypes.ELEMENT &&
      (node.tagType === ElementTypes.ELEMENT ||
        node.tagType === ElementTypes.COMPONENT)
    )
  ) {
    return
  }
  const ref = findProp(node, 'ref')
  if (!ref) return
  const refKey =
    ref.type === NodeTypes.ATTRIBUTE
      ? ref.value
        ? createSimpleExpression(ref.value.content, true, ref.value.loc)
        : null
      : ref.exp
  if (refKey) {
    node.props[node.props.indexOf(ref)] = {
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: createSimpleExpression(`ref`, true, ref.loc),
      exp: createCompoundExpression([`[_ctx, `, refKey, `]`]),
      modifiers: [],
      loc: ref.loc
    }
  }
}
