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
import {
  getLiteralExpressionValue,
  isConstantExpression,
  isStaticExpression,
} from '../utils'

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

  const isFragment =
    node.type === NodeTypes.ROOT ||
    (node.type === NodeTypes.ELEMENT &&
      (node.tagType === ElementTypes.TEMPLATE ||
        node.tagType === ElementTypes.COMPONENT))

  if (
    (isFragment ||
      (node.type === NodeTypes.ELEMENT &&
        node.tagType === ElementTypes.ELEMENT)) &&
    node.children.length
  ) {
    let hasInterp = false
    let isAllTextLike = true
    for (const c of node.children) {
      if (c.type === NodeTypes.INTERPOLATION) {
        hasInterp = true
      } else if (c.type !== NodeTypes.TEXT) {
        isAllTextLike = false
      }
    }
    // all text like with interpolation
    if (!isFragment && isAllTextLike && hasInterp) {
      processTextContainer(
        node.children as TextLike[],
        context as TransformContext<ElementNode>,
      )
    } else if (hasInterp) {
      // check if there's any text before interpolation, it needs to be merged
      for (let i = 0; i < node.children.length; i++) {
        const c = node.children[i]
        const prev = node.children[i - 1]
        if (
          c.type === NodeTypes.INTERPOLATION &&
          prev &&
          prev.type === NodeTypes.TEXT
        ) {
          // mark leading text node for skipping
          seen.get(context.root)!.add(prev)
        }
      }
    }
  } else if (node.type === NodeTypes.INTERPOLATION) {
    processInterpolation(context as TransformContext<InterpolationNode>)
  } else if (node.type === NodeTypes.TEXT) {
    context.template += node.content
  }
}

function processInterpolation(context: TransformContext<InterpolationNode>) {
  const children = context.parent!.node.children
  const nexts = children.slice(context.index)
  const idx = nexts.findIndex(n => !isTextLike(n))
  const nodes = (idx > -1 ? nexts.slice(0, idx) : nexts) as Array<TextLike>

  // merge leading text
  const prev = children[context.index - 1]
  if (prev && prev.type === NodeTypes.TEXT) {
    nodes.unshift(prev)
  }

  context.template += ' '
  const id = context.reference()
  const values = nodes.map(node => createTextLikeExpression(node, context))

  const nonConstantExps = values.filter(v => !isConstantExpression(v))
  const isStatic =
    !nonConstantExps.length ||
    nonConstantExps.every(e =>
      isStaticExpression(e, context.options.bindingMetadata),
    ) ||
    context.inVOnce

  if (isStatic) {
    context.registerOperation({
      type: IRNodeTypes.SET_TEXT,
      element: id,
      values,
    })
  } else {
    context.registerEffect(values, {
      type: IRNodeTypes.SET_TEXT,
      element: id,
      values,
    })
  }
}

function processTextContainer(
  children: TextLike[],
  context: TransformContext<ElementNode>,
) {
  const values = children.map(child => createTextLikeExpression(child, context))
  const literals = values.map(getLiteralExpressionValue)
  if (literals.every(l => l != null)) {
    context.childrenTemplate = literals.map(l => String(l))
  } else {
    context.childrenTemplate = [' ']
    context.registerOperation({
      type: IRNodeTypes.GET_TEXT_CHILD,
      parent: context.reference(),
    })
    context.registerEffect(values, {
      type: IRNodeTypes.SET_TEXT,
      element: context.reference(),
      values,
      // indicates this node is generated, so prefix should be "x" instead of "n"
      generated: true,
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

function isTextLike(node: TemplateChildNode): node is TextLike {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}
