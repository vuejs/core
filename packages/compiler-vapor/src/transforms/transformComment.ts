import {
  type CommentNode,
  type ElementNode,
  NodeTypes,
  type TemplateChildNode,
} from '@vue/compiler-dom'
import type { NodeTransform, TransformContext } from '../transform'
import { DynamicFlag } from '../ir'

export const transformComment: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.COMMENT) return

  if (getSiblingIf(context as TransformContext<CommentNode>)) {
    context.comment.push(node)
    context.dynamic.flags |= DynamicFlag.NON_TEMPLATE
  } else {
    context.template += `<!--${node.content}-->`
  }
}

export function getSiblingIf(
  context: TransformContext<TemplateChildNode>,
  reverse?: boolean,
): ElementNode | undefined {
  const parent = context.parent
  if (!parent) return

  const siblings = parent.node.children
  let sibling: TemplateChildNode | undefined
  let i = siblings.indexOf(context.node)
  while (reverse ? --i >= 0 : ++i < siblings.length) {
    sibling = siblings[i]
    if (!isCommentLike(sibling)) {
      break
    }
  }

  if (
    sibling &&
    sibling.type === NodeTypes.ELEMENT &&
    sibling.props.some(
      ({ type, name }) =>
        type === NodeTypes.DIRECTIVE &&
        ['else-if', reverse ? 'if' : 'else'].includes(name),
    )
  ) {
    return sibling
  }
}

function isCommentLike(node: TemplateChildNode) {
  return (
    node.type === NodeTypes.COMMENT ||
    (node.type === NodeTypes.TEXT && !node.content.trim().length)
  )
}
