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
  return (): void => {
    const appear = findProp(node, 'appear', false, true)
    wipMap.set(node, !!appear)
  }
}

export function ssrProcessTransition(
  node: ComponentNode,
  context: SSRTransformContext,
): void {
  // #5351: filter out comment children inside transition
  node.children = node.children.filter(c => c.type !== NodeTypes.COMMENT)

  // a vapor branch of several nodes keeps its range: the client reads it as
  // the one unit a branch is anywhere else
  const disableNestedFragments = !context.options.vapor
  const appear = wipMap.get(node)
  if (appear) {
    context.pushStringPart(`<template>`)
    processChildren(node, context, false, disableNestedFragments)
    context.pushStringPart(`</template>`)
  } else {
    processChildren(node, context, false, disableNestedFragments)
  }
}
