import type { NodeTransform } from '@vue/compiler-vapor'
import { findDir, isTransitionTag } from '../utils'
import {
  type ElementNode,
  ElementTypes,
  NodeTypes,
  isTemplateNode,
  postTransformTransition,
} from '@vue/compiler-dom'

export const transformTransition: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT
  ) {
    if (isTransitionTag(node.tag)) {
      return postTransformTransition(
        node,
        context.options.onError,
        hasMultipleChildren,
      )
    }
  }
}

function hasMultipleChildren(node: ElementNode): boolean {
  const children = (node.children = node.children.filter(
    c =>
      c.type !== NodeTypes.COMMENT &&
      !(c.type === NodeTypes.TEXT && !c.content.trim()),
  ))

  const first = children[0]

  if (children.length === 1 && first.type === NodeTypes.ELEMENT) {
    // has v-for
    if (findDir(first, 'for')) {
      return true
    }

    // Template branches should be validated based on their rendered children.
    if (isTemplateNode(first)) {
      return hasMultipleChildren(first)
    }
  }

  const hasElse = (node: ElementNode) =>
    findDir(node, 'else-if') || findDir(node, 'else', true)

  // has v-if/v-else-if/v-else
  if (
    children.length > 0 &&
    children.every(
      (c, index) =>
        c.type === NodeTypes.ELEMENT &&
        (!isTemplateNode(c) || !hasMultipleChildren(c)) &&
        // not has v-for
        !findDir(c, 'for') &&
        // if the first child has v-if, the rest should also have v-else-if/v-else
        (index === 0 ? findDir(c, 'if') : hasElse(c)),
    )
  ) {
    return false
  }

  return children.length !== 1
}
