import type { BigIntLiteral, NumericLiteral, StringLiteral } from '@babel/types'
import { isGloballyAllowed } from '@vue/shared'
import {
  type AttributeNode,
  BindingTypes,
  type ElementNode,
  NodeTypes,
  type SimpleExpressionNode,
  findDir as _findDir,
  findProp as _findProp,
  createSimpleExpression,
  isConstantNode,
  isLiteralWhitelisted,
} from '@vue/compiler-dom'
import type { VaporDirectiveNode } from './ir'
import { EMPTY_EXPRESSION } from './transforms/utils'
import type { TransformContext } from './transform'

export const findProp = _findProp as (
  node: ElementNode,
  name: string,
  dynamicOnly?: boolean,
  allowEmpty?: boolean,
) => AttributeNode | VaporDirectiveNode | undefined

/** find directive */
export const findDir = _findDir as (
  node: ElementNode,
  name: string | RegExp,
  allowEmpty?: boolean,
) => VaporDirectiveNode | undefined

export function propToExpression(
  prop: AttributeNode | VaporDirectiveNode,
): SimpleExpressionNode | undefined {
  return prop.type === NodeTypes.ATTRIBUTE
    ? prop.value
      ? createSimpleExpression(prop.value.content, true, prop.value.loc)
      : EMPTY_EXPRESSION
    : prop.exp
}

export function isConstantExpression(exp: SimpleExpressionNode): boolean {
  return (
    isLiteralWhitelisted(exp.content) ||
    isGloballyAllowed(exp.content) ||
    getLiteralExpressionValue(exp) !== null
  )
}

export function isStaticExpression(
  context: TransformContext,
  expressions: SimpleExpressionNode[],
): boolean {
  const {
    options: { bindingMetadata },
  } = context
  const isLiteralConst = (name: string) =>
    bindingMetadata[name] === BindingTypes.LITERAL_CONST
  return expressions.every(node => {
    if (node.ast) {
      return isConstantNode(node.ast, isLiteralConst)
    } else if (node.ast === null) {
      return isLiteralConst(node.content)
    }
  })
}

export function resolveExpression(
  exp: SimpleExpressionNode,
): SimpleExpressionNode {
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
): number | string | boolean | null {
  if (exp.ast) {
    if (exp.ast.type === 'StringLiteral') {
      return (exp.ast as StringLiteral | NumericLiteral | BigIntLiteral).value
    } else if (
      exp.ast.type === 'TemplateLiteral' &&
      exp.ast.expressions.length === 0
    ) {
      return exp.ast.quasis[0].value.cooked!
    }
  }
  return exp.isStatic ? exp.content : null
}
