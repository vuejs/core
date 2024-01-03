import {
  type ComponentNode,
  NodeTypes,
  type TransformContext,
  findProp,
} from '@vue/compiler-dom'
import {
  type SSRTransformContext,
  processChildren,
} from '../ssrCodegenTransform'

const wipMap = new WeakMap<ComponentNode, Boolean>()

export function ssrTransformTransition(
  node: ComponentNode,
  context: TransformContext,
) {
  return () => {
    const appear = findProp(node, 'appear', false, true)
    wipMap.set(node, !!appear)
  }
}

export function ssrProcessTransition(
  node: ComponentNode,
  context: SSRTransformContext,
) {
  // #5351: filter out comment children inside transition
  node.children = node.children.filter(c => c.type !== NodeTypes.COMMENT)

  const appear = wipMap.get(node)
  if (appear) {
    context.pushStringPart(`<template>`)
    processChildren(node, context, false, true)
    context.pushStringPart(`</template>`)
  } else {
    processChildren(node, context, false, true)
  }
}
