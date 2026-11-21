import {
  type ComponentNode,
  type ExpressionNode,
  NodeTypes,
  type TransformContext,
  createConditionalExpression,
  createSimpleExpression,
  findProp,
} from '@vue/compiler-dom'
import {
  type SSRTransformContext,
  processChildren,
} from '../ssrCodegenTransform'

// `true` for a static `appear`, the expression of a bound one
const wipMap = new WeakMap<ComponentNode, true | ExpressionNode>()

export function ssrTransformTransition(
  node: ComponentNode,
  context: TransformContext,
) {
  return (): void => {
    const appear = findProp(node, 'appear', false, true)
    const value = appear?.type === NodeTypes.ATTRIBUTE ? true : appear?.exp
    if (value) wipMap.set(node, value)
  }
}

export function ssrProcessTransition(
  node: ComponentNode,
  context: SSRTransformContext,
): void {
  // #5351: filter out comment children inside transition
  node.children = node.children.filter(c => c.type !== NodeTypes.COMMENT)

  const appear = wipMap.get(node)
  if (appear) {
    // a bound `appear` adds the <template> only while it is truthy
    const tag = (markup: string) =>
      appear === true
        ? markup
        : createConditionalExpression(
            appear,
            createSimpleExpression(markup, true),
            createSimpleExpression(``, true),
            false,
          )
    context.pushStringPart(tag(`<template>`))
    processChildren(node, context, false, true)
    context.pushStringPart(tag(`</template>`))
  } else {
    processChildren(node, context, false, true)
  }
}
