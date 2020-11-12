import {
  RootNode,
  NodeTypes,
  TemplateChildNode,
  SimpleExpressionNode,
  ElementTypes,
  PlainElementNode,
  ComponentNode,
  TemplateNode,
  VNodeCall,
  ParentNode
} from '../ast'
import { TransformContext } from '../transform'
import { PatchFlags, isString, isSymbol } from '@vue/shared'
import { isSlotOutlet } from '../utils'

export function hoistStatic(root: RootNode, context: TransformContext) {
  walk(
    root,
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

const enum StaticType {
  NOT_STATIC = 0,
  FULL_STATIC,
  HAS_RUNTIME_CONSTANT
}

function walk(
  node: ParentNode,
  context: TransformContext,
  resultCache: Map<TemplateChildNode, StaticType>,
  doNotHoistNode: boolean = false
) {
  let hasHoistedNode = false
  // Some transforms, e.g. transformAssetUrls from @vue/compiler-sfc, replaces
  // static bindings with expressions. These expressions are guaranteed to be
  // constant so they are still eligible for hoisting, but they are only
  // available at runtime and therefore cannot be evaluated ahead of time.
  // This is only a concern for pre-stringification (via transformHoist by
  // @vue/compiler-dom), but doing it here allows us to perform only one full
  // walk of the AST and allow `stringifyStatic` to stop walking as soon as its
  // stringficiation threshold is met.
  let hasRuntimeConstant = false

  const { children } = node
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    // only plain elements & text calls are eligible for hoisting.
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT
    ) {
      let staticType
      if (
        !doNotHoistNode &&
        (staticType = getStaticType(child, resultCache)) > 0
      ) {
        if (staticType === StaticType.HAS_RUNTIME_CONSTANT) {
          hasRuntimeConstant = true
        }
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
            !hasNonHoistableProps(child)
          ) {
            const props = getNodeProps(child)
            if (props) {
              codegenNode.props = context.hoist(props)
            }
          }
        }
      }
    } else if (child.type === NodeTypes.TEXT_CALL) {
      const staticType = getStaticType(child.content, resultCache)
      if (staticType > 0) {
        if (staticType === StaticType.HAS_RUNTIME_CONSTANT) {
          hasRuntimeConstant = true
        }
        child.codegenNode = context.hoist(child.codegenNode)
        hasHoistedNode = true
      }
    }

    // walk further
    if (child.type === NodeTypes.ELEMENT) {
      walk(child, context, resultCache)
    } else if (child.type === NodeTypes.FOR) {
      // Do not hoist v-for single child because it has to be a block
      walk(child, context, resultCache, child.children.length === 1)
    } else if (child.type === NodeTypes.IF) {
      for (let i = 0; i < child.branches.length; i++) {
        // Do not hoist v-if single child because it has to be a block
        walk(
          child.branches[i],
          context,
          resultCache,
          child.branches[i].children.length === 1
        )
      }
    }
  }

  if (!hasRuntimeConstant && hasHoistedNode && context.transformHoist) {
    context.transformHoist(children, context, node)
  }
}

export function getStaticType(
  node: TemplateChildNode | SimpleExpressionNode,
  resultCache: Map<TemplateChildNode, StaticType> = new Map()
): StaticType {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      if (node.tagType !== ElementTypes.ELEMENT) {
        return StaticType.NOT_STATIC
      }
      const cached = resultCache.get(node)
      if (cached !== undefined) {
        return cached
      }
      const codegenNode = node.codegenNode!
      if (codegenNode.type !== NodeTypes.VNODE_CALL) {
        return StaticType.NOT_STATIC
      }
      const flag = getPatchFlag(codegenNode)
      if (!flag && !hasNonHoistableProps(node)) {
        // element self is static. check its children.
        let returnType = StaticType.FULL_STATIC
        for (let i = 0; i < node.children.length; i++) {
          const childType = getStaticType(node.children[i], resultCache)
          if (childType === StaticType.NOT_STATIC) {
            resultCache.set(node, StaticType.NOT_STATIC)
            return StaticType.NOT_STATIC
          } else if (childType === StaticType.HAS_RUNTIME_CONSTANT) {
            returnType = StaticType.HAS_RUNTIME_CONSTANT
          }
        }

        // check if any of the props contain runtime constants
        if (returnType !== StaticType.HAS_RUNTIME_CONSTANT) {
          for (let i = 0; i < node.props.length; i++) {
            const p = node.props[i]
            if (
              p.type === NodeTypes.DIRECTIVE &&
              p.name === 'bind' &&
              p.exp &&
              (p.exp.type === NodeTypes.COMPOUND_EXPRESSION ||
                p.exp.isRuntimeConstant)
            ) {
              returnType = StaticType.HAS_RUNTIME_CONSTANT
            }
          }
        }

        // only svg/foreignObject could be block here, however if they are
        // stati then they don't need to be blocks since there will be no
        // nested updates.
        if (codegenNode.isBlock) {
          codegenNode.isBlock = false
        }

        resultCache.set(node, returnType)
        return returnType
      } else {
        resultCache.set(node, StaticType.NOT_STATIC)
        return StaticType.NOT_STATIC
      }
    case NodeTypes.TEXT:
    case NodeTypes.COMMENT:
      return StaticType.FULL_STATIC
    case NodeTypes.IF:
    case NodeTypes.FOR:
    case NodeTypes.IF_BRANCH:
      return StaticType.NOT_STATIC
    case NodeTypes.INTERPOLATION:
    case NodeTypes.TEXT_CALL:
      return getStaticType(node.content, resultCache)
    case NodeTypes.SIMPLE_EXPRESSION:
      return node.isRuntimeConstant
        ? StaticType.HAS_RUNTIME_CONSTANT
        : node.isConstant
          ? StaticType.FULL_STATIC
          : StaticType.NOT_STATIC
    case NodeTypes.COMPOUND_EXPRESSION:
      let returnType = StaticType.FULL_STATIC
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (isString(child) || isSymbol(child)) {
          continue
        }
        const childType = getStaticType(child, resultCache)
        if (childType === StaticType.NOT_STATIC) {
          return StaticType.NOT_STATIC
        } else if (childType === StaticType.HAS_RUNTIME_CONSTANT) {
          returnType = StaticType.HAS_RUNTIME_CONSTANT
        }
      }
      return returnType
    default:
      if (__DEV__) {
        const exhaustiveCheck: never = node
        exhaustiveCheck
      }
      return StaticType.NOT_STATIC
  }
}

/**
 * Even for a node with no patch flag, it is possible for it to contain
 * non-hoistable expressions that refers to scope variables, e.g. compiler
 * injected keys or cached event handlers. Therefore we need to always check the
 * codegenNode's props to be sure.
 */
function hasNonHoistableProps(node: PlainElementNode): boolean {
  const props = getNodeProps(node)
  if (props && props.type === NodeTypes.JS_OBJECT_EXPRESSION) {
    const { properties } = props
    for (let i = 0; i < properties.length; i++) {
      const { key, value } = properties[i]
      if (
        key.type !== NodeTypes.SIMPLE_EXPRESSION ||
        !key.isStatic ||
        (value.type !== NodeTypes.SIMPLE_EXPRESSION ||
          (!value.isStatic && !value.isConstant))
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
