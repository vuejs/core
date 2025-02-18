import {
  type CacheExpression,
  type CallExpression,
  type ComponentNode,
  ConstantTypes,
  ElementTypes,
  type ExpressionNode,
  type JSChildNode,
  NodeTypes,
  type ParentNode,
  type PlainElementNode,
  type RootNode,
  type SimpleExpressionNode,
  type SlotFunctionExpression,
  type TemplateChildNode,
  type TemplateNode,
  type TextCallNode,
  type VNodeCall,
  createArrayExpression,
  getVNodeBlockHelper,
  getVNodeHelper,
} from '../ast'
import type { TransformContext } from '../transform'
import { PatchFlags, isArray, isString, isSymbol } from '@vue/shared'
import { findDir, isSlotOutlet } from '../utils'
import {
  GUARD_REACTIVE_PROPS,
  NORMALIZE_CLASS,
  NORMALIZE_PROPS,
  NORMALIZE_STYLE,
  OPEN_BLOCK,
} from '../runtimeHelpers'

export function cacheStatic(root: RootNode, context: TransformContext): void {
  walk(
    root,
    undefined,
    context,
    // Root node is unfortunately non-hoistable due to potential parent
    // fallthrough attributes.
    isSingleElementRoot(root, root.children[0]),
  )
}

export function isSingleElementRoot(
  root: RootNode,
  child: TemplateChildNode,
): child is PlainElementNode | ComponentNode | TemplateNode {
  const { children } = root
  return (
    children.length === 1 &&
    child.type === NodeTypes.ELEMENT &&
    !isSlotOutlet(child)
  )
}

function walk(
  node: ParentNode,
  parent: ParentNode | undefined,
  context: TransformContext,
  doNotHoistNode: boolean = false,
  inFor = false,
) {
  const { children } = node
  const toCache: (PlainElementNode | TextCallNode)[] = []
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    // only plain elements & text calls are eligible for caching.
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT
    ) {
      const constantType = doNotHoistNode
        ? ConstantTypes.NOT_CONSTANT
        : getConstantType(child, context)
      if (constantType > ConstantTypes.NOT_CONSTANT) {
        if (constantType >= ConstantTypes.CAN_CACHE) {
          ;(child.codegenNode as VNodeCall).patchFlag = PatchFlags.CACHED
          toCache.push(child)
          continue
        }
      } else {
        // node may contain dynamic children, but its props may be eligible for
        // hoisting.
        const codegenNode = child.codegenNode!
        if (codegenNode.type === NodeTypes.VNODE_CALL) {
          const flag = codegenNode.patchFlag
          if (
            (flag === undefined ||
              flag === PatchFlags.NEED_PATCH ||
              flag === PatchFlags.TEXT) &&
            getGeneratedPropsConstantType(child, context) >=
              ConstantTypes.CAN_CACHE
          ) {
            const props = getNodeProps(child)
            if (props) {
              codegenNode.props = context.hoist(props)
            }
          }
          if (codegenNode.dynamicProps) {
            codegenNode.dynamicProps = context.hoist(codegenNode.dynamicProps)
          }
        }
      }
    } else if (child.type === NodeTypes.TEXT_CALL) {
      const constantType = doNotHoistNode
        ? ConstantTypes.NOT_CONSTANT
        : getConstantType(child, context)
      if (constantType >= ConstantTypes.CAN_CACHE) {
        toCache.push(child)
        continue
      }
    }

    // walk further
    if (child.type === NodeTypes.ELEMENT) {
      const isComponent = child.tagType === ElementTypes.COMPONENT
      if (isComponent) {
        context.scopes.vSlot++
      }
      walk(child, node, context, false, inFor)
      if (isComponent) {
        context.scopes.vSlot--
      }
    } else if (child.type === NodeTypes.FOR) {
      // Do not hoist v-for single child because it has to be a block
      walk(child, node, context, child.children.length === 1, true)
    } else if (child.type === NodeTypes.IF) {
      for (let i = 0; i < child.branches.length; i++) {
        // Do not hoist v-if single child because it has to be a block
        walk(
          child.branches[i],
          node,
          context,
          child.branches[i].children.length === 1,
          inFor,
        )
      }
    }
  }

  let cachedAsArray = false
  if (toCache.length === children.length && node.type === NodeTypes.ELEMENT) {
    if (
      node.tagType === ElementTypes.ELEMENT &&
      node.codegenNode &&
      node.codegenNode.type === NodeTypes.VNODE_CALL &&
      isArray(node.codegenNode.children)
    ) {
      // all children were hoisted - the entire children array is cacheable.
      node.codegenNode.children = getCacheExpression(
        createArrayExpression(node.codegenNode.children),
      )
      cachedAsArray = true
    } else if (
      node.tagType === ElementTypes.COMPONENT &&
      node.codegenNode &&
      node.codegenNode.type === NodeTypes.VNODE_CALL &&
      node.codegenNode.children &&
      !isArray(node.codegenNode.children) &&
      node.codegenNode.children.type === NodeTypes.JS_OBJECT_EXPRESSION
    ) {
      // default slot
      const slot = getSlotNode(node.codegenNode, 'default')
      if (slot) {
        slot.returns = getCacheExpression(
          createArrayExpression(slot.returns as TemplateChildNode[]),
        )
        cachedAsArray = true
      }
    } else if (
      node.tagType === ElementTypes.TEMPLATE &&
      parent &&
      parent.type === NodeTypes.ELEMENT &&
      parent.tagType === ElementTypes.COMPONENT &&
      parent.codegenNode &&
      parent.codegenNode.type === NodeTypes.VNODE_CALL &&
      parent.codegenNode.children &&
      !isArray(parent.codegenNode.children) &&
      parent.codegenNode.children.type === NodeTypes.JS_OBJECT_EXPRESSION
    ) {
      // named <template> slot
      const slotName = findDir(node, 'slot', true)
      const slot =
        slotName &&
        slotName.arg &&
        getSlotNode(parent.codegenNode, slotName.arg)
      if (slot) {
        slot.returns = getCacheExpression(
          createArrayExpression(slot.returns as TemplateChildNode[]),
        )
        cachedAsArray = true
      }
    }
  }

  if (!cachedAsArray) {
    for (const child of toCache) {
      child.codegenNode = context.cache(child.codegenNode!)
    }
  }

  function getCacheExpression(value: JSChildNode): CacheExpression {
    const exp = context.cache(value)
    // #6978, #7138, #7114
    // a cached children array inside v-for can caused HMR errors since
    // it might be mutated when mounting the first item
    if (inFor && context.hmr) {
      exp.needArraySpread = true
    }
    return exp
  }

  function getSlotNode(
    node: VNodeCall,
    name: string | ExpressionNode,
  ): SlotFunctionExpression | undefined {
    if (
      node.children &&
      !isArray(node.children) &&
      node.children.type === NodeTypes.JS_OBJECT_EXPRESSION
    ) {
      const slot = node.children.properties.find(
        p => p.key === name || (p.key as SimpleExpressionNode).content === name,
      )
      return slot && slot.value
    }
  }

  if (toCache.length && context.transformHoist) {
    context.transformHoist(children, context, node)
  }
}

export function getConstantType(
  node: TemplateChildNode | SimpleExpressionNode | CacheExpression,
  context: TransformContext,
): ConstantTypes {
  const { constantCache } = context
  switch (node.type) {
    case NodeTypes.ELEMENT:
      if (node.tagType !== ElementTypes.ELEMENT) {
        return ConstantTypes.NOT_CONSTANT
      }
      const cached = constantCache.get(node)
      if (cached !== undefined) {
        return cached
      }
      const codegenNode = node.codegenNode!
      if (codegenNode.type !== NodeTypes.VNODE_CALL) {
        return ConstantTypes.NOT_CONSTANT
      }
      if (
        codegenNode.isBlock &&
        node.tag !== 'svg' &&
        node.tag !== 'foreignObject' &&
        node.tag !== 'math'
      ) {
        return ConstantTypes.NOT_CONSTANT
      }
      if (codegenNode.patchFlag === undefined) {
        let returnType = ConstantTypes.CAN_STRINGIFY

        // Element itself has no patch flag. However we still need to check:

        // 1. Even for a node with no patch flag, it is possible for it to contain
        // non-hoistable expressions that refers to scope variables, e.g. compiler
        // injected keys or cached event handlers. Therefore we need to always
        // check the codegenNode's props to be sure.
        const generatedPropsType = getGeneratedPropsConstantType(node, context)
        if (generatedPropsType === ConstantTypes.NOT_CONSTANT) {
          constantCache.set(node, ConstantTypes.NOT_CONSTANT)
          return ConstantTypes.NOT_CONSTANT
        }
        if (generatedPropsType < returnType) {
          returnType = generatedPropsType
        }

        // 2. its children.
        for (let i = 0; i < node.children.length; i++) {
          const childType = getConstantType(node.children[i], context)
          if (childType === ConstantTypes.NOT_CONSTANT) {
            constantCache.set(node, ConstantTypes.NOT_CONSTANT)
            return ConstantTypes.NOT_CONSTANT
          }
          if (childType < returnType) {
            returnType = childType
          }
        }

        // 3. if the type is not already CAN_SKIP_PATCH which is the lowest non-0
        // type, check if any of the props can cause the type to be lowered
        // we can skip can_patch because it's guaranteed by the absence of a
        // patchFlag.
        if (returnType > ConstantTypes.CAN_SKIP_PATCH) {
          for (let i = 0; i < node.props.length; i++) {
            const p = node.props[i]
            if (p.type === NodeTypes.DIRECTIVE && p.name === 'bind' && p.exp) {
              const expType = getConstantType(p.exp, context)
              if (expType === ConstantTypes.NOT_CONSTANT) {
                constantCache.set(node, ConstantTypes.NOT_CONSTANT)
                return ConstantTypes.NOT_CONSTANT
              }
              if (expType < returnType) {
                returnType = expType
              }
            }
          }
        }

        // only svg/foreignObject could be block here, however if they are
        // static then they don't need to be blocks since there will be no
        // nested updates.
        if (codegenNode.isBlock) {
          // except set custom directives.
          for (let i = 0; i < node.props.length; i++) {
            const p = node.props[i]
            if (p.type === NodeTypes.DIRECTIVE) {
              constantCache.set(node, ConstantTypes.NOT_CONSTANT)
              return ConstantTypes.NOT_CONSTANT
            }
          }

          context.removeHelper(OPEN_BLOCK)
          context.removeHelper(
            getVNodeBlockHelper(context.inSSR, codegenNode.isComponent),
          )
          codegenNode.isBlock = false
          context.helper(getVNodeHelper(context.inSSR, codegenNode.isComponent))
        }

        constantCache.set(node, returnType)
        return returnType
      } else {
        constantCache.set(node, ConstantTypes.NOT_CONSTANT)
        return ConstantTypes.NOT_CONSTANT
      }
    case NodeTypes.TEXT:
    case NodeTypes.COMMENT:
      return ConstantTypes.CAN_STRINGIFY
    case NodeTypes.IF:
    case NodeTypes.FOR:
    case NodeTypes.IF_BRANCH:
      return ConstantTypes.NOT_CONSTANT
    case NodeTypes.INTERPOLATION:
    case NodeTypes.TEXT_CALL:
      return getConstantType(node.content, context)
    case NodeTypes.SIMPLE_EXPRESSION:
      return node.constType
    case NodeTypes.COMPOUND_EXPRESSION:
      let returnType = ConstantTypes.CAN_STRINGIFY
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (isString(child) || isSymbol(child)) {
          continue
        }
        const childType = getConstantType(child, context)
        if (childType === ConstantTypes.NOT_CONSTANT) {
          return ConstantTypes.NOT_CONSTANT
        } else if (childType < returnType) {
          returnType = childType
        }
      }
      return returnType
    case NodeTypes.JS_CACHE_EXPRESSION:
      return ConstantTypes.CAN_CACHE
    default:
      if (__DEV__) {
        const exhaustiveCheck: never = node
        exhaustiveCheck
      }
      return ConstantTypes.NOT_CONSTANT
  }
}

const allowHoistedHelperSet = new Set([
  NORMALIZE_CLASS,
  NORMALIZE_STYLE,
  NORMALIZE_PROPS,
  GUARD_REACTIVE_PROPS,
])

function getConstantTypeOfHelperCall(
  value: CallExpression,
  context: TransformContext,
): ConstantTypes {
  if (
    value.type === NodeTypes.JS_CALL_EXPRESSION &&
    !isString(value.callee) &&
    allowHoistedHelperSet.has(value.callee)
  ) {
    const arg = value.arguments[0] as JSChildNode
    if (arg.type === NodeTypes.SIMPLE_EXPRESSION) {
      return getConstantType(arg, context)
    } else if (arg.type === NodeTypes.JS_CALL_EXPRESSION) {
      // in the case of nested helper call, e.g. `normalizeProps(guardReactiveProps(exp))`
      return getConstantTypeOfHelperCall(arg, context)
    }
  }
  return ConstantTypes.NOT_CONSTANT
}

function getGeneratedPropsConstantType(
  node: PlainElementNode,
  context: TransformContext,
): ConstantTypes {
  let returnType = ConstantTypes.CAN_STRINGIFY
  const props = getNodeProps(node)
  if (props && props.type === NodeTypes.JS_OBJECT_EXPRESSION) {
    const { properties } = props
    for (let i = 0; i < properties.length; i++) {
      const { key, value } = properties[i]
      const keyType = getConstantType(key, context)
      if (keyType === ConstantTypes.NOT_CONSTANT) {
        return keyType
      }
      if (keyType < returnType) {
        returnType = keyType
      }
      let valueType: ConstantTypes
      if (value.type === NodeTypes.SIMPLE_EXPRESSION) {
        valueType = getConstantType(value, context)
      } else if (value.type === NodeTypes.JS_CALL_EXPRESSION) {
        // some helper calls can be hoisted,
        // such as the `normalizeProps` generated by the compiler for pre-normalize class,
        // in this case we need to respect the ConstantType of the helper's arguments
        valueType = getConstantTypeOfHelperCall(value, context)
      } else {
        valueType = ConstantTypes.NOT_CONSTANT
      }
      if (valueType === ConstantTypes.NOT_CONSTANT) {
        return valueType
      }
      if (valueType < returnType) {
        returnType = valueType
      }
    }
  }
  return returnType
}

function getNodeProps(node: PlainElementNode) {
  const codegenNode = node.codegenNode!
  if (codegenNode.type === NodeTypes.VNODE_CALL) {
    return codegenNode.props
  }
}
