import {
  RootNode,
  NodeTypes,
  TemplateChildNode,
  ElementNode,
  ElementTypes,
  ElementCodegenNode,
  ElementCodegenNodeWithDirective
} from '../ast'
import { TransformContext } from '../transform'
import { APPLY_DIRECTIVES } from '../runtimeHelpers'
import { PatchFlags } from '@vue/shared'

export function hoistStatic(root: RootNode, context: TransformContext) {
  walk(root.children, context, new Map<TemplateChildNode, boolean>())
}

function walk(
  children: TemplateChildNode[],
  context: TransformContext,
  resultCache: Map<TemplateChildNode, boolean>
) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    // only plain elements are eligible for hoisting.
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT
    ) {
      if (isStaticNode(child, resultCache)) {
        // whole tree is static
        ;(child as any).codegenNode = context.hoist(child.codegenNode!)
        continue
      } else {
        // node may contain dynamic children, but its props may be eligible for
        // hoisting.
        const flag = getPatchFlag(child)
        if (
          !flag ||
          flag === PatchFlags.NEED_PATCH ||
          flag === PatchFlags.TEXT
        ) {
          let codegenNode = child.codegenNode!
          if (codegenNode.callee === APPLY_DIRECTIVES) {
            codegenNode = codegenNode.arguments[0]
          }
          const props = codegenNode.arguments[1]
          if (props && props !== `null`) {
            codegenNode.arguments[1] = context.hoist(props)
          }
        }
      }
    }
    if (child.type === NodeTypes.ELEMENT || child.type === NodeTypes.FOR) {
      walk(child.children, context, resultCache)
    } else if (child.type === NodeTypes.IF) {
      for (let i = 0; i < child.branches.length; i++) {
        walk(child.branches[i].children, context, resultCache)
      }
    }
  }
}

function getPatchFlag(node: ElementNode): number | undefined {
  let codegenNode = node.codegenNode as
    | ElementCodegenNode
    | ElementCodegenNodeWithDirective
  if (codegenNode.callee === APPLY_DIRECTIVES) {
    codegenNode = codegenNode.arguments[0]
  }
  const flag = codegenNode.arguments[3]
  return flag ? parseInt(flag as string, 10) : undefined
}

function isStaticNode(
  node: TemplateChildNode,
  resultCache: Map<TemplateChildNode, boolean>
): boolean {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      if (node.tagType !== ElementTypes.ELEMENT) {
        return false
      }
      if (resultCache.has(node)) {
        return resultCache.get(node) as boolean
      }
      const flag = getPatchFlag(node)
      if (!flag) {
        // element self is static. check its children.
        for (let i = 0; i < node.children.length; i++) {
          if (!isStaticNode(node.children[i], resultCache)) {
            resultCache.set(node, false)
            return false
          }
        }
        resultCache.set(node, true)
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
