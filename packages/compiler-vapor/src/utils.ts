import {
  type AttributeNode,
  type ElementNode,
  NodeTypes,
  findProp as _findProp,
  createSimpleExpression,
} from '@vue/compiler-dom'
import type { VaporDirectiveNode } from './ir'
import { EMPTY_EXPRESSION } from './transform'

export const findProp = _findProp as (
  node: ElementNode,
  name: string,
  dynamicOnly?: boolean,
  allowEmpty?: boolean,
) => AttributeNode | VaporDirectiveNode | undefined

export function propToExpression(prop: AttributeNode | VaporDirectiveNode) {
  return prop.type === NodeTypes.ATTRIBUTE
    ? prop.value
      ? createSimpleExpression(prop.value.content, true, prop.value.loc)
      : EMPTY_EXPRESSION
    : prop.exp
}
