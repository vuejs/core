import {
  RootNode,
  NodeTypes,
  TemplateChildNode,
  CallExpression,
  ElementNode
} from '../ast'
import { TransformContext } from '../transform'
import { CREATE_VNODE } from '../runtimeConstants'
import { PropsExpression } from './transformElement'

export function hoistStatic(root: RootNode, context: TransformContext) {
  walk(root.children, context, new Set<TemplateChildNode>())
}

function walk(
  children: TemplateChildNode[],
  context: TransformContext,
  knownStaticNodes: Set<TemplateChildNode>
) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type === NodeTypes.ELEMENT) {
      if (isStaticNode(child, knownStaticNodes)) {
        // whole tree is static
        child.codegenNode = context.hoist(child.codegenNode!)
        continue
      } else if (!getPatchFlag(child)) {
        // has dynamic children, but self props are static, hoist props instead
        const props = (child.codegenNode as CallExpression).arguments[1] as
          | PropsExpression
          | `null`
        if (props !== `null`) {
          ;(child.codegenNode as CallExpression).arguments[1] = context.hoist(
            props
          )
        }
      }
    }
    if (child.type === NodeTypes.ELEMENT || child.type === NodeTypes.FOR) {
      walk(child.children, context, knownStaticNodes)
    } else if (child.type === NodeTypes.IF) {
      for (let i = 0; i < child.branches.length; i++) {
        walk(child.branches[i].children, context, knownStaticNodes)
      }
    }
  }
}

function getPatchFlag(node: ElementNode): number | undefined {
  const codegenNode = node.codegenNode as CallExpression
  if (
    // callee is createVNode (i.e. no runtime directives)
    codegenNode.callee.includes(CREATE_VNODE)
  ) {
    const flag = codegenNode.arguments[3]
    return flag ? parseInt(flag as string, 10) : undefined
  }
}

function isStaticNode(
  node: TemplateChildNode,
  knownStaticNodes: Set<TemplateChildNode>
): boolean {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      if (knownStaticNodes.has(node)) {
        return true
      }
      const flag = getPatchFlag(node)
      if (!flag) {
        // element self is static. check its children.
        for (let i = 0; i < node.children.length; i++) {
          if (!isStaticNode(node.children[i], knownStaticNodes)) {
            return false
          }
        }
        knownStaticNodes.add(node)
        return true
      } else {
        return false
      }
    case NodeTypes.TEXT:
    case NodeTypes.COMMENT:
      return true
    case NodeTypes.IF:
    case NodeTypes.FOR:
    case NodeTypes.INTERPOLATION:
    case NodeTypes.COMPOUND_EXPRESSION:
      return false
    default:
      if (__DEV__) {
        const exhaustiveCheck: never = node
        exhaustiveCheck
      }
      return false
  }
}
