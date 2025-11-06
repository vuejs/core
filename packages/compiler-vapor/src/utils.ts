import { isGloballyAllowed } from '@vue/shared'
import {
  type AttributeNode,
  type BindingMetadata,
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
  node: SimpleExpressionNode,
  bindings: BindingMetadata,
): boolean {
  if (node.ast) {
    return isConstantNode(node.ast, bindings)
  } else if (node.ast === null) {
    const type = bindings[node.content]
    return type === BindingTypes.LITERAL_CONST
  }
  return false
}

export function resolveExpression(
  exp: SimpleExpressionNode,
  isComponent?: boolean,
): SimpleExpressionNode {
  if (!exp.isStatic) {
    const value = getLiteralExpressionValue(exp, isComponent)
    if (value !== null) {
      return createSimpleExpression(value, true, exp.loc)
    }
  }
  return exp
}

export function getLiteralExpressionValue(
  exp: SimpleExpressionNode,
  excludeNumber?: boolean,
): string | null {
  if (exp.ast) {
    if (exp.ast.type === 'StringLiteral') {
      return exp.ast.value
    } else if (
      !excludeNumber &&
      (exp.ast.type === 'NumericLiteral' || exp.ast.type === 'BigIntLiteral')
    ) {
      return String(exp.ast.value)
    } else if (exp.ast.type === 'TemplateLiteral') {
      let result = ''
      for (const [index, quasi] of exp.ast.quasis.entries()) {
        result += quasi.value.cooked!
        if (exp.ast.expressions[index]) {
          let expressionValue = getLiteralExpressionValue({
            ast: exp.ast.expressions[index],
          } as SimpleExpressionNode)
          if (expressionValue == null) {
            return null
          } else {
            result += expressionValue
          }
        }
      }
      return result
    }
  }
  return exp.isStatic ? exp.content : null
}

export function isInTransition(
  context: TransformContext<ElementNode>,
): boolean {
  const parentNode = context.parent && context.parent.node
  return !!(parentNode && isTransitionNode(parentNode as ElementNode))
}

export function isTransitionNode(node: ElementNode): boolean {
  return node.type === NodeTypes.ELEMENT && isTransitionTag(node.tag)
}

export function isTransitionGroupNode(node: ElementNode): boolean {
  return node.type === NodeTypes.ELEMENT && isTransitionGroupTag(node.tag)
}

export function isTransitionTag(tag: string): boolean {
  tag = tag.toLowerCase()
  return tag === 'transition' || tag === 'vaportransition'
}

export function isTransitionGroupTag(tag: string): boolean {
  tag = tag.toLowerCase().replace(/-/g, '')
  return tag === 'transitiongroup' || tag === 'vaportransitiongroup'
}

export function isKeepAliveTag(tag: string): boolean {
  tag = tag.toLowerCase()
  return tag === 'keepalive' || tag === 'vaporkeepalive'
}

export function isTeleportTag(tag: string): boolean {
  tag = tag.toLowerCase()
  return tag === 'teleport' || tag === 'vaporteleport'
}

export function isBuiltInComponent(tag: string): string | undefined {
  if (isTeleportTag(tag)) {
    return 'VaporTeleport'
  } else if (isKeepAliveTag(tag)) {
    return 'VaporKeepAlive'
  } else if (isTransitionTag(tag)) {
    return 'VaporTransition'
  } else if (isTransitionGroupTag(tag)) {
    return 'VaporTransitionGroup'
  }
}
