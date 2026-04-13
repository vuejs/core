import {
  type CommentNode,
  type ElementNode,
  NodeTypes,
  type RootNode,
  type TemplateChildNode,
  isCommentOrWhitespace,
} from '@vue/compiler-dom'
import type { NodeTransform, TransformContext } from '../transform'
import { DynamicFlag } from '../ir'
import { escapeHtml } from '@vue/shared'

const ignoredComments = new WeakMap<
  TransformContext<RootNode>,
  WeakSet<CommentNode>
>()

export function ignoreComment(
  node: CommentNode,
  context: TransformContext,
): void {
  let ignored = ignoredComments.get(context.root)
  if (!ignored) {
    ignoredComments.set(context.root, (ignored = new WeakSet()))
  }
  ignored.add(node)
}

export const transformComment: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.COMMENT) return

  if (ignoredComments.get(context.root)?.has(node)) {
    context.dynamic.flags |= DynamicFlag.NON_TEMPLATE
  } else if (getSiblingIf(context as TransformContext<CommentNode>)) {
    context.comment.push(node)
    context.dynamic.flags |= DynamicFlag.NON_TEMPLATE
  } else {
    context.template += `<!--${escapeHtml(node.content)}-->`
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
    if (!isCommentOrWhitespace(sibling)) {
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
