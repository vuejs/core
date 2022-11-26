import { NodeTransform } from '../transform'
import { findDir } from '../utils'
import {
  createCallExpression,
  createFunctionExpression,
  NodeTypes,
  PlainElementNode
} from '../ast'

const seen = new WeakSet()

export const transformLet: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    const dir = findDir(node, 'let')
    if (!dir || seen.has(node)) {
      return
    }
    seen.add(node)
    return () => {
      const codegenNode =
        node.codegenNode ||
        (context.currentNode as PlainElementNode).codegenNode
      if (codegenNode && codegenNode.type === NodeTypes.VNODE_CALL) {
        node.codegenNode = createCallExpression(createFunctionExpression(
          [dir.exp!],
          codegenNode,
        ))
      }
    }
  }
}


export const trackVLetScopes: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT
  ) {
    const vLet = findDir(node, 'let')
    if (vLet) {
      const vLetExp = vLet.exp
      if (!__BROWSER__ && context.prefixIdentifiers) {
        vLetExp && context.addIdentifiers(vLetExp)
      }
      return () => {
        if (!__BROWSER__ && context.prefixIdentifiers) {
          vLetExp && context.removeIdentifiers(vLetExp)
        }
      }
    }
  }
}