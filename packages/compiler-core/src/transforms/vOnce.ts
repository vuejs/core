import { NodeTransform } from '../transform'
import { findDir, hasScopeRef } from '../utils'
import { ElementNode, ForNode, IfNode, NodeTypes } from '../ast'
import { SET_BLOCK_TRACKING } from '../runtimeHelpers'
import { createCompilerError, ErrorCodes } from '@vue/compiler-core'

const seen = new WeakSet()

export const transformOnce: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT && findDir(node, 'once', true)) {
    if (seen.has(node) || context.inVOnce) {
      return
    }

    if (
      context.prefixIdentifiers &&
      context.scopes.vFor > 0 &&
      context.parent!.type !== NodeTypes.FOR &&
      hasScopeRef(node, context.identifiers)
    ) {
      context.onError(
        createCompilerError(ErrorCodes.X_V_ONCE_INSIDE_FOR, node.loc)
      )
    }

    seen.add(node)
    context.inVOnce = true
    context.helper(SET_BLOCK_TRACKING)
    return () => {
      context.inVOnce = false
      const cur = context.currentNode as ElementNode | IfNode | ForNode
      if (cur.codegenNode) {
        cur.codegenNode = context.cache(cur.codegenNode, true /* isVNode */)
      }
    }
  }
}
