import type { NumericLiteral, StringLiteral } from '@babel/types'
import { isGloballyAllowed } from '@vue/shared'
import {
  type AttributeNode,
  type ElementNode,
  NodeTypes,
  type SimpleExpressionNode,
  findProp as _findProp,
  createSimpleExpression,
  isLiteralWhitelisted,
} from '@vue/compiler-dom'
import type { VaporDirectiveNode } from './ir'
import { EMPTY_EXPRESSION } from './transforms/utils'

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

export function isConstantExpression(exp: SimpleExpressionNode) {
  return (
    isLiteralWhitelisted(exp.content) ||
    isGloballyAllowed(exp.content) ||
    getLiteralExpressionValue(exp) !== null
  )
}

export function resolveExpression(exp: SimpleExpressionNode) {
  if (!exp.isStatic) {
    const value = getLiteralExpressionValue(exp)
    if (value !== null) {
      return createSimpleExpression('' + value, true, exp.loc)
    }
  }
  return exp
}

export function getLiteralExpressionValue(
  exp: SimpleExpressionNode,
): number | string | null {
  if (
    !__BROWSER__ &&
    exp.ast &&
    ['StringLiteral', 'NumericLiteral'].includes(exp.ast.type)
  ) {
    return (exp.ast as StringLiteral | NumericLiteral).value
  }
  return exp.isStatic ? exp.content : null
}
