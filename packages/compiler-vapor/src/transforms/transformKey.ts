import {
  type ElementNode,
  NodeTypes,
  type SimpleExpressionNode,
} from '@vue/compiler-dom'
import type { NodeTransform } from '../transform'
import { DynamicFlag, IRNodeTypes } from '../ir'
import { normalizeBindShorthand } from './vBind'
import { findDir, findProp, isComponentTag, isStaticExpression } from '../utils'
import { newBlock, wrapTemplate } from './utils'

// A runtime dynamic component keys its own branches, so its `:key` is handed
// to createDynamicComponent instead of wrapping it in a keyed fragment.
export const dynamicComponentKeys: WeakMap<ElementNode, SimpleExpressionNode> =
  new WeakMap()

export const transformKey: NodeTransform = (node, context) => {
  if (
    node.type !== NodeTypes.ELEMENT ||
    context.inVOnce ||
    findDir(node, 'for')
  )
    return

  const dir = findProp(node, 'key', true, true)
  if (!dir || dir.type === NodeTypes.ATTRIBUTE) return

  let value: SimpleExpressionNode
  value = dir.exp || normalizeBindShorthand(dir.arg!, context)
  if (isStaticExpression(value, context.options.bindingMetadata)) return

  if (isComponentTag(node.tag) && findProp(node, 'is', true, true)) {
    dynamicComponentKeys.set(node, value)
    return
  }

  let id = context.reference()
  context.dynamic.flags |= DynamicFlag.NON_TEMPLATE | DynamicFlag.INSERT

  context.node = node = wrapTemplate(node, ['key'])
  const block = newBlock(node)
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
