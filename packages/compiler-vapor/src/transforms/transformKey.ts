import {
  type AttributeNode,
  type ElementNode,
  ElementTypes,
  NodeTypes,
  type SimpleExpressionNode,
  advancePositionWithClone,
  createSimpleExpression,
  isSimpleIdentifier,
} from '@vue/compiler-dom'
import type { Expression, ObjectExpression, ObjectProperty } from '@babel/types'
import { parseExpression } from '@babel/parser'
import type { NodeTransform, TransformContext } from '../transform'
import { DynamicFlag, IRNodeTypes, type VaporDirectiveNode } from '../ir'
import { normalizeBindShorthand } from './vBind'
import { findDir, findProp, isComponentTag, isStaticExpression } from '../utils'
import { newBlock, wrapTemplate } from './utils'
import { getParserOptions } from '../generators/utils'

// A runtime dynamic component keys its own branches, so its key is handed to
// createDynamicComponent instead of wrapping it in a keyed fragment.
export const dynamicComponentKeys: WeakMap<ElementNode, SimpleExpressionNode> =
  new WeakMap()

export const transformKey: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    context.inVOnce ||
    findDir(node, 'for') ||
    // same as vdom: a key on a <template> v-if branch or slot is ignored
    (node.tagType === ElementTypes.TEMPLATE &&
      findDir(node, /^(if|else-if|else|slot)$/, true))
  )
    return

  // The keyed wrapper retains the original object-form v-bind on its child.
  // Do not wrap that same key a second time, while still transforming keys
  // on descendants of the child.
  if (
    context.block.keyed &&
    context.parent &&
    context.parent.node === context.block.node
  )
    return

  if (isComponentTag(node.tag) && findProp(node, 'is', true, true)) {
    const value = resolveKey(node, context)
    if (value) dynamicComponentKeys.set(node, value)
    return
  }

  const value = resolveKey(node, context)
  if (
    !value ||
    value.isStatic ||
    isStaticExpression(value, context.options.bindingMetadata)
  )
    return
  // a `<slot>` keeps its key as a slot prop when `wrapTemplate` moves the key
  // to a wrapper, and that wrapper already does the keying
  const parent = context.parent && context.parent.node
  const dir = findProp(node, 'key', true, true)
  if (
    node.tagType === ElementTypes.SLOT &&
    dir &&
    parent &&
    parent.type === NodeTypes.ELEMENT &&
    parent.props.includes(dir)
  )
    return

  let id = context.reference()
  context.dynamic.flags |= DynamicFlag.NON_TEMPLATE | DynamicFlag.INSERT

  context.node = node = wrapTemplate(node, ['key'])
  const block = newBlock(node)
  block.keyed = true
  const exitBlock = context.enterBlock(block)

  return () => {
    exitBlock()
    context.dynamic.operation = {
      type: IRNodeTypes.KEY,
      id,
      ...context.effectBoundary(),
      value,
      block,
    }
  }
}

function resolveKey(
  node: ElementNode,
  context: TransformContext,
): SimpleExpressionNode | undefined {
  let value: SimpleExpressionNode | undefined
  const props = node.props as (AttributeNode | VaporDirectiveNode)[]
  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'key') {
      value = prop.value
        ? createSimpleExpression(prop.value.content, true, prop.value.loc)
        : createSimpleExpression('', true, prop.loc)
      continue
    }
    if (prop.type !== NodeTypes.DIRECTIVE || prop.name !== 'bind') continue
    if (prop.arg?.isStatic && prop.arg.content === 'key') {
      value = prop.exp || normalizeBindShorthand(prop.arg, context)
      continue
    }
    if (prop.arg || !prop.exp) continue
    const ast = prop.exp.ast
    if (!ast || ast.type !== 'ObjectExpression') continue
    for (const item of (ast as ObjectExpression).properties) {
      if (item.type !== 'ObjectProperty' || item.computed) continue
      const key = getObjectPropertyName(item as ObjectProperty)
      if (key === 'key')
        value = createObjectValueExpression(
          prop.exp,
          item.value as Expression,
          context,
        )
    }
  }
  return value
}

function getObjectPropertyName(prop: ObjectProperty): string | undefined {
  if (prop.key.type === 'Identifier') return prop.key.name
  if (prop.key.type === 'StringLiteral') return prop.key.value
}

function createObjectValueExpression(
  source: SimpleExpressionNode,
  value: Expression,
  context: TransformContext,
): SimpleExpressionNode {
  const start = value.start == null ? 0 : value.start - 1
  const end = value.end == null ? source.content.length : value.end - 1
  const content = source.content.slice(start, end)
  const expression = createSimpleExpression(content, false, {
    start: advancePositionWithClone(source.loc.start, source.content, start),
    end: advancePositionWithClone(source.loc.start, source.content, end),
    source: content,
  })
  expression.ast = isSimpleIdentifier(content)
    ? null
    : parseExpression(
        `(${content})`,
        getParserOptions(context.options.expressionPlugins),
      )
  return expression
}
