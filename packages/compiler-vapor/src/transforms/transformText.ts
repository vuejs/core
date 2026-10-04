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
import { getLiteralExpressionValue } from '../utils'
import { escapeHtml } from '@vue/shared'
import { shouldUseCreateElement } from './transformElement'

type TextLike = TextNode | InterpolationNode
const seen = new WeakMap<
  TransformContext<RootNode>,
  WeakSet<TemplateChildNode | RootNode>
>()

export function markNonTemplate(
  node: TemplateChildNode,
  context: TransformContext,
): void {
  let seenNodes = seen.get(context.root)
  if (!seenNodes) {
    seenNodes = new WeakSet()
    seen.set(context.root, seenNodes)
  }
  seenNodes.add(node)
}

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
      const elementContext = context as TransformContext<ElementNode>
      if (shouldUseCreateElement(node, elementContext)) {
        processCreateElementTextContainer(
          node.children as TextLike[],
          elementContext,
        )
      } else {
        processTextContainer(node.children as TextLike[], elementContext)
      }
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
          markNonTemplate(prev, context)
        }
      }
    }
  } else if (node.type === NodeTypes.INTERPOLATION) {
    processInterpolation(context as TransformContext<InterpolationNode>)
  } else if (node.type === NodeTypes.TEXT) {
    const parent = context.parent?.node
    const createElementParent =
      parent &&
      parent.type === NodeTypes.ELEMENT &&
      shouldUseCreateElement(
        parent,
        context.parent as TransformContext<ElementNode>,
      )
    const isRootText =
      !parent ||
      parent.type === NodeTypes.ROOT ||
      (parent.type === NodeTypes.ELEMENT &&
        (parent.tagType === ElementTypes.TEMPLATE ||
          parent.tagType === ElementTypes.COMPONENT))

    // Only text that ends up inside a template's html string is parsed again
    // at runtime, so only that text is escaped. Root-level text and the
    // children of a `createElement`-backed parent reach the dom through
    // `createTextNode`, where escaping it would put the escape sequence
    // itself into the dom - `&` showing up as `&amp;`.
    const isRawText = createElementParent || isRootText

    // Unescaped text becomes a template of its own, and the runtime only turns
    // such a template into a text node when it does not start with "<" (see
    // `template()` in runtime-vapor). Text that does start with "<" has to be
    // materialized imperatively, or it would be parsed as html instead.
    if (isRawText && node.content[0] === '<') {
      materializeLiteralTextNode(
        createSimpleExpression(node.content, true, node.loc),
        context as TransformContext<TextNode>,
      )
      return
    }

    context.template += isRawText ? node.content : escapeHtml(node.content)
  }
}

function processInterpolation(context: TransformContext<InterpolationNode>) {
  const parentNode = context.parent!.node
  const values = processTextLikeChildren(collectAdjacentText(context), context)

  if (values.length === 0 && parentNode.type !== NodeTypes.ROOT) {
    return
  }

  const literalValues = values.map(v => getLiteralExpressionValue(v))
  const allLiteral = literalValues.every(v => v != null)
  const text = allLiteral ? literalValues.join('') : null
  const isElementChild =
    parentNode.type === NodeTypes.ELEMENT &&
    parentNode.tagType === ElementTypes.ELEMENT
  if (
    text !== null &&
    parentNode.type !== NodeTypes.ROOT &&
    (isElementChild || text !== '')
  ) {
    // same as for plain text: a literal is escaped only when it lands inside a
    // template's html string, and one that is not escaped must not be left for
    // the runtime to parse as html
    const isRawText =
      !isElementChild ||
      (parentNode.type === NodeTypes.ELEMENT &&
        shouldUseCreateElement(
          parentNode,
          context.parent as TransformContext<ElementNode>,
        ))
    if (isRawText && text[0] === '<') {
      materializeLiteralTextNode(
        createSimpleExpression(text, true, context.node.loc),
        context,
      )
      return
    }
    context.template += isRawText ? text : escapeHtml(text)
    return
  }

  context.template += ' '
  const id = context.reference()
  context.dynamic.isText = isElementChild

  if (values.length === 0) {
    return
  }

  context.registerEffect(values, {
    type: IRNodeTypes.SET_TEXT,
    element: id,
    values,
  })
}

function collectAdjacentText(
  context: TransformContext<InterpolationNode>,
): TextLike[] {
  const children = context.parent!.node.children
  const nodes: TextLike[] = []
  // Include leading text that belongs to the same text run.
  const prev = children[context.index - 1]
  let index =
    prev && prev.type === NodeTypes.TEXT ? context.index - 1 : context.index

  for (; index < children.length; index++) {
    const child = children[index]
    if (!isTextLike(child)) break
    nodes.push(child)
  }

  return nodes
}

function processTextContainer(
  children: TextLike[],
  context: TransformContext<ElementNode>,
) {
  const values = processTextLikeChildren(children, context)

  const literals = values.map(value => getLiteralExpressionValue(value))

  if (literals.every(l => l != null)) {
    context.childrenTemplate = literals.map(l => escapeHtml(String(l)))
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

export function registerSyntheticTextChild(
  context: TransformContext<ElementNode>,
  template: string,
  values?: SimpleExpressionNode[],
): number {
  const id = context.increaseId()
  context.dynamic.children[context.node.children.length] = {
    id,
    flags: DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE,
    children: [],
    template: context.pushTemplate(template),
  }
  context.dynamic.hasDynamicChild = true

  if (values && values.length) {
    context.registerEffect(values, {
      type: IRNodeTypes.SET_TEXT,
      element: id,
      values,
    })
  }

  return id
}

function processCreateElementTextContainer(
  children: TextLike[],
  context: TransformContext<ElementNode>,
) {
  const values = processTextLikeChildren(children, context)
  // createElement-backed parents must materialize text nodes imperatively so
  // text that starts with "<" remains text instead of being parsed as HTML.
  registerSyntheticTextChild(context, '', values)
}

function materializeLiteralTextNode(
  value: SimpleExpressionNode,
  context: TransformContext<TextNode | InterpolationNode>,
) {
  const id = context.reference()
  context.dynamic.flags |= DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE
  context.dynamic.template = context.pushTemplate('')
  context.registerEffect([value], {
    type: IRNodeTypes.SET_TEXT,
    element: id,
    values: [value],
  })
}

function processTextLikeChildren(nodes: TextLike[], context: TransformContext) {
  const exps: SimpleExpressionNode[] = []
  for (const node of nodes) {
    let exp: SimpleExpressionNode
    markNonTemplate(node, context)

    if (node.type === NodeTypes.TEXT) {
      exp = createSimpleExpression(node.content, true, node.loc)
    } else {
      exp = node.content as SimpleExpressionNode
    }

    if (exp.content) exps.push(exp)
  }

  return exps
}

function isTextLike(node: TemplateChildNode): node is TextLike {
  return node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT
}
