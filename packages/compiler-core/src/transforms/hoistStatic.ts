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
  VNodeCall
} from '../ast'
import { TransformContext } from '../transform'
import { PatchFlags, isString, isSymbol } from '@vue/shared'
import { isSlotOutlet, findProp } from '../utils'

export function hoistStatic(root: RootNode, context: TransformContext) {
  walk(
    root.children,
    context,
    new Map(),
    // Root node is unfortunately non-hoistable due to potential parent
    // fallthrough attributes.
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
  let hasHoistedNode = false
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    // only plain elements & text calls are eligible for hoisting.
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT
    ) {
      if (!doNotHoistNode && isStaticNode(child, resultCache)) {
        // whole tree is static
        ;(child.codegenNode as VNodeCall).patchFlag =
          PatchFlags.HOISTED + (__DEV__ ? ` /* HOISTED */` : ``)
        child.codegenNode = context.hoist(child.codegenNode!)
        hasHoistedNode = true
        continue
      } else {
        // node may contain dynamic children, but its props may be eligible for
        // hoisting.
        const codegenNode = child.codegenNode!
        if (codegenNode.type === NodeTypes.VNODE_CALL) {
          const flag = getPatchFlag(codegenNode)
          if (
            (!flag ||
              flag === PatchFlags.NEED_PATCH ||
              flag === PatchFlags.TEXT) &&
            !hasDynamicKeyOrRef(child) &&
            !hasCachedProps(child)
          ) {
            const props = getNodeProps(child)
            if (props) {
              codegenNode.props = context.hoist(props)
            }
          }
        }
      }
    } else if (
      child.type === NodeTypes.TEXT_CALL &&
      isStaticNode(child.content, resultCache)
    ) {
      child.codegenNode = context.hoist(child.codegenNode)
      hasHoistedNode = true
    }

    // walk further
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

  if (hasHoistedNode && context.transformHoist) {
    context.transformHoist(children, context)
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
      if (codegenNode.type !== NodeTypes.VNODE_CALL) {
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
        // only svg/foreignObject could be block here, however if they are static
        // then they don't need to be blocks since there will be no nested
        // updates.
        if (codegenNode.isBlock) {
          codegenNode.isBlock = false
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
    case NodeTypes.IF_BRANCH:
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
  if (props && props.type === NodeTypes.JS_OBJECT_EXPRESSION) {
    const { properties } = props
    for (let i = 0; i < properties.length; i++) {
      const val = properties[i].value
      if (val.type === NodeTypes.JS_CACHE_EXPRESSION) {
        return true
      }
      // merged event handlers
      if (
        val.type === NodeTypes.JS_ARRAY_EXPRESSION &&
        val.elements.some(
          e => !isString(e) && e.type === NodeTypes.JS_CACHE_EXPRESSION
        )
      ) {
        return true
      }
    }
  }
  return false
}

function getNodeProps(node: PlainElementNode) {
  const codegenNode = node.codegenNode!
  if (codegenNode.type === NodeTypes.VNODE_CALL) {
    return codegenNode.props
  }
}

function getPatchFlag(node: VNodeCall): number | undefined {
  const flag = node.patchFlag
  return flag ? parseInt(flag, 10) : undefined
}
