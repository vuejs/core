import {
  type ElementNode,
  ElementTypes,
  type InterpolationNode,
  NodeTypes,
  type RootNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
  type TextNode,
  createSimpleExpression,
} from '@vue/compiler-dom'
import type { NodeTransform, TransformContext } from '../transform'
import { DynamicFlag, IRNodeTypes } from '../ir'
import { getLiteralExpressionValue, isConstantExpression } from '../utils'

type TextLike = TextNode | InterpolationNode
const seen = new WeakMap<
  TransformContext<RootNode>,
  WeakSet<TemplateChildNode | RootNode>
>()

export const transformText: NodeTransform = (node, context) => {
  if (!seen.has(context.root)) seen.set(context.root, new WeakSet())
  if (seen.get(context.root)!.has(node)) {
    context.dynamic.flags |= DynamicFlag.NON_TEMPLATE
    return
  }

  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT &&
    isAllTextLike(node.children)
  ) {
    processTextLikeContainer(
      node.children,
      context as TransformContext<ElementNode>,
    )
  } else if (node.type === NodeTypes.INTERPOLATION) {
    processTextLike(context as TransformContext<InterpolationNode>)
  } else if (node.type === NodeTypes.TEXT) {
    context.template += node.content
  }
}

function processTextLike(context: TransformContext<InterpolationNode>) {
  const nexts = context.parent!.node.children.slice(context.index)
  const idx = nexts.findIndex(n => !isTextLike(n))
  const nodes = (idx > -1 ? nexts.slice(0, idx) : nexts) as Array<TextLike>

  const id = context.reference()
  const values = nodes.map(node => createTextLikeExpression(node, context))

  context.dynamic.flags |= DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE

  context.registerOperation({
    type: IRNodeTypes.CREATE_TEXT_NODE,
    id,
    values,
    effect: !values.every(isConstantExpression) && !context.inVOnce,
  })
}

function processTextLikeContainer(
  children: TextLike[],
  context: TransformContext<ElementNode>,
) {
  const values = children.map(child => createTextLikeExpression(child, context))
  const literals = values.map(getLiteralExpressionValue)
  if (literals.every(l => l != null)) {
    context.childrenTemplate = literals.map(l => String(l))
  } else {
    context.registerEffect(values, {
      type: IRNodeTypes.SET_TEXT,
      element: context.reference(),
      values,
    })
  }
}

function createTextLikeExpression(node: TextLike, context: TransformContext) {
  seen.get(context.root)!.add(node)
  if (node.type === NodeTypes.TEXT) {
    return createSimpleExpression(node.content, true, node.loc)
  } else {
    return node.content as SimpleExpressionNode
  }
}

function isAllTextLike(children: TemplateChildNode[]): children is TextLike[] {
  return (
    !!children.length &&
    children.every(isTextLike) &&
    // at least one an interpolation
    children.some(n => n.type === NodeTypes.INTERPOLATION)
  )
}

function isTextLike(node: TemplateChildNode): node is TextLike {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}
