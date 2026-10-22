import type { NodeTransform } from '../transform'
import { findDir } from '../utils'
import { type ElementNode, type ForNode, type IfNode, NodeTypes } from '../ast'
import { SET_BLOCK_TRACKING } from '../runtimeHelpers'

const seen = new WeakSet()

export const transformOnce: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT && findDir(node, 'once', true)) {
    if (
      seen.has(node) ||
      context.inVOnce ||
      context.inSSR ||
      // v-if moves v-else(-if) nodes into its branches and renders them once
      findDir(node, /^else(-if)?$/, true)
    ) {
      return
    }
    seen.add(node)
    context.inVOnce = true
    context.helper(SET_BLOCK_TRACKING)
    return () => {
      context.inVOnce = false
      const cur = context.currentNode as ElementNode | IfNode | ForNode
      if (cur.codegenNode) {
        cur.codegenNode = context.cache(
          cur.codegenNode,
          true /* isVNode */,
          true /* inVOnce */,
        )
      }
    }
  }
}
