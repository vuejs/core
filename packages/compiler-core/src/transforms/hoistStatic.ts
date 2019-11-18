import {
  RootNode,
  NodeTypes,
  TemplateChildNode,
  SimpleExpressionNode,
  ElementTypes,
  PlainElementNode,
  ComponentNode,
  TemplateNode,
  ElementNode,
  PlainElementCodegenNode,
  CodegenNodeWithDirective
} from '../ast'
import { TransformContext } from '../transform'
import { WITH_DIRECTIVES } from '../runtimeHelpers'
import { PatchFlags, isString, isSymbol } from '@vue/shared'
import { isSlotOutlet, findProp } from '../utils'

export function hoistStatic(root: RootNode, context: TransformContext) {
  walk(
    root.children,
    context,
    new Map(),
    isSingleElementRoot(root, root.children[0])
  )
}

export function isSingleElementRoot(
  root: RootNode,
  child: TemplateChildNode
): child is PlainElementNode | ComponentNode | TemplateNode {
  const { children } = root
  return (
    children.length === 1 &&
    child.type === NodeTypes.ELEMENT &&
    !isSlotOutlet(child)
  )
}

function walk(
  children: TemplateChildNode[],
  context: TransformContext,
  resultCache: Map<TemplateChildNode, boolean>,
  doNotHoistNode: boolean = false
) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    // only plain elements are eligible for hoisting.
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT
    ) {
      if (!doNotHoistNode && isStaticNode(child, resultCache)) {
        // whole tree is static
        child.codegenNode = context.hoist(child.codegenNode!)
        continue
      } else {
        // node may contain dynamic children, but its props may be eligible for
        // hoisting.
        const codegenNode = child.codegenNode!
        if (codegenNode.type === NodeTypes.JS_CALL_EXPRESSION) {
          const flag = getPatchFlag(codegenNode)
          if (
            (!flag ||
              flag === PatchFlags.NEED_PATCH ||
              flag === PatchFlags.TEXT) &&
            !hasDynamicKeyOrRef(child) &&
            !hasCachedProps(child)
          ) {
            const props = getNodeProps(child)
            if (props && props !== `null`) {
              getVNodeCall(codegenNode).arguments[1] = context.hoist(props)
            }
          }
        }
      }
    }
    if (child.type === NodeTypes.ELEMENT) {
      walk(child.children, context, resultCache)
    } else if (child.type === NodeTypes.FOR) {
      // Do not hoist v-for single child because it has to be a block
      walk(child.children, context, resultCache, child.children.length === 1)
    } else if (child.type === NodeTypes.IF) {
      for (let i = 0; i < child.branches.length; i++) {
        const branchChildren = child.branches[i].children
        // Do not hoist v-if single child because it has to be a block
        walk(branchChildren, context, resultCache, branchChildren.length === 1)
      }
    }
  }
}

export function isStaticNode(
  node: TemplateChildNode | SimpleExpressionNode,
  resultCache: Map<TemplateChildNode, boolean> = new Map()
): boolean {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      if (node.tagType !== ElementTypes.ELEMENT) {
        return false
      }
      const cached = resultCache.get(node)
      if (cached !== undefined) {
        return cached
      }
      const codegenNode = node.codegenNode!
      if (codegenNode.type !== NodeTypes.JS_CALL_EXPRESSION) {
        return false
      }
      const flag = getPatchFlag(codegenNode)
      if (!flag && !hasDynamicKeyOrRef(node) && !hasCachedProps(node)) {
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
        resultCache.set(node, false)
        return false
      }
    case NodeTypes.TEXT:
    case NodeTypes.COMMENT:
      return true
    case NodeTypes.IF:
    case NodeTypes.FOR:
      return false
    case NodeTypes.INTERPOLATION:
    case NodeTypes.TEXT_CALL:
      return isStaticNode(node.content, resultCache)
    case NodeTypes.SIMPLE_EXPRESSION:
      return node.isConstant
    case NodeTypes.COMPOUND_EXPRESSION:
      return node.children.every(child => {
        return (
          isString(child) || isSymbol(child) || isStaticNode(child, resultCache)
        )
      })
    default:
      if (__DEV__) {
        const exhaustiveCheck: never = node
        exhaustiveCheck
      }
      return false
  }
}

function hasDynamicKeyOrRef(node: ElementNode): boolean {
  return !!(findProp(node, 'key', true) || findProp(node, 'ref', true))
}

function hasCachedProps(node: PlainElementNode): boolean {
  if (__BROWSER__) {
    return false
  }
  const props = getNodeProps(node)
  if (
    props &&
    props !== 'null' &&
    props.type === NodeTypes.JS_OBJECT_EXPRESSION
  ) {
    const { properties } = props
    for (let i = 0; i < properties.length; i++) {
      if (properties[i].value.type === NodeTypes.JS_CACHE_EXPRESSION) {
        return true
      }
    }
  }
  return false
}

function getNodeProps(node: PlainElementNode) {
  const codegenNode = node.codegenNode!
  if (codegenNode.type === NodeTypes.JS_CALL_EXPRESSION) {
    return getVNodeArgAt(
      codegenNode,
      1
    ) as PlainElementCodegenNode['arguments'][1]
  }
}

type NonCachedCodegenNode =
  | PlainElementCodegenNode
  | CodegenNodeWithDirective<PlainElementCodegenNode>

function getVNodeArgAt(
  node: NonCachedCodegenNode,
  index: number
): PlainElementCodegenNode['arguments'][number] {
  return getVNodeCall(node).arguments[index]
}

function getVNodeCall(node: NonCachedCodegenNode) {
  return node.callee === WITH_DIRECTIVES ? node.arguments[0] : node
}

function getPatchFlag(node: NonCachedCodegenNode): number | undefined {
  const flag = getVNodeArgAt(node, 3) as string
  return flag ? parseInt(flag, 10) : undefined
}
