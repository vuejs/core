import {
  ComponentNode,
  findProp,
  NodeTypes,
  TransformContext
} from '@vue/compiler-dom'
import { processChildren, SSRTransformContext } from '../ssrCodegenTransform'

const wipMap = new WeakMap<ComponentNode, Boolean>()

export function ssrTransformTransition(
  node: ComponentNode,
  context: TransformContext
) {
  return () => {
    const appear = findProp(node, 'appear', false, true)
    if (appear) {
      wipMap.set(node, true)
    }
  }
}

export function ssrProcessTransition(
  node: ComponentNode,
  context: SSRTransformContext
) {
  node.children = node.children.filter(c => c.type !== NodeTypes.COMMENT)

  const hasAppear = wipMap.get(node)
  if (hasAppear) {
    context.pushStringPart(`<template>`)
    processChildren(node, context, false, true)
    context.pushStringPart(`</template>`)
  } else {
    processChildren(node, context, false, true)
  }
}
