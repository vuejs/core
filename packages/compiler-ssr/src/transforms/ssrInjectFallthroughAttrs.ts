import {
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type ParentNode,
  type RootNode,
  type TemplateChildNode,
  type TemplateNode,
  type TransformContext,
  createSimpleExpression,
  findDir,
  hasSingleChild,
  isSingleIfBlock,
  isTemplateNode,
  locStub,
} from '@vue/compiler-dom'
import { extend, isSymbol } from '@vue/shared'
import { componentTypeMap, rawOptionsMap } from './ssrTransformComponent'

// the `v-bind="_slotAttrs"` injected on the root of a vapor slot body
export const slotAttrsBinds: WeakMap<ElementNode, DirectiveNode> = new WeakMap()

// what holds the root of a vapor slot body, the implicit default slot aside:
// a slot template, and what is all a body renders and renders its own content
// in its place: a `v-if` branch, a Transition or a KeepAlive
const slotBodies = new WeakSet<ParentNode>()

export const ssrInjectFallthroughAttrs: NodeTransform = (node, context) => {
  // _attrs is provided as a function argument.
  // mark it as a known identifier so that it doesn't get prefixed by
  // transformExpression.
  if (node.type === NodeTypes.ROOT) {
    context.identifiers._attrs = 1
    // likewise for a slot function's, see `resolveVaporSlotBody`
    if (rawOptionsMap.get(node)!.vapor) context.identifiers._slotAttrs = 1
  }

  const parent = context.parent
  if (!parent) {
    return
  }

  // what the single root in `body` inherits
  let attrs = `_attrs`
  let body: ParentNode = parent
  const inSlot = parent.type !== NodeTypes.ROOT
  if (inSlot) {
    const slotBody = slotBodies.has(parent)
      ? parent
      : resolveVaporSlotBody(parent, context)
    if (!slotBody) {
      return
    }
    if (isSlotTemplate(node)) {
      slotBodies.add(node)
      return
    }
    attrs = `_slotAttrs`
    body = slotBody
  }

  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT &&
    (node.tag === 'transition' ||
      node.tag === 'Transition' ||
      node.tag === 'KeepAlive' ||
      node.tag === 'keep-alive')
  ) {
    if (hasSingleChild(body)) {
      if (inSlot) {
        // what it renders is the root in turn
        slotBodies.add(node)
      } else if (hasSingleChild(node)) {
        injectFallthroughAttrs(node.children[0], attrs)
      }
      return
    }
  }

  if (node.type === NodeTypes.IF_BRANCH) {
    if (isSingleIfBlock(body)) {
      if (inSlot) {
        // what it holds is the root in turn, as the client finds it: past
        // comments, down a chain or a `<template v-if>` in it
        slotBodies.add(node)
      } else if (hasSingleChild(node)) {
        injectFallthroughAttrs(node.children[0], attrs)
      }
    }
  } else if (hasSingleChild(body)) {
    injectFallthroughAttrs(node, attrs)
  }
}

// In a vapor component, the single root of a slot body inherits the attrs a
// vdom `cloneVNode` adds to the slot's content, which the slot function gets
// as `_slotAttrs`: the client applies them to that root too.
function resolveVaporSlotBody(
  parent: ParentNode,
  context: TransformContext,
): ParentNode | undefined {
  if (
    parent.type !== NodeTypes.ELEMENT ||
    parent.tagType !== ElementTypes.COMPONENT ||
    !rawOptionsMap.get(context.root)!.vapor ||
    // built-ins render their slots their own way
    isSymbol(componentTypeMap.get(parent))
  ) {
    return
  }
  // the implicit default slot: what is not in a slot template
  return parent.children.some(isSlotTemplate)
    ? extend({}, parent, {
        children: parent.children.filter(c => !isSlotTemplate(c)),
      })
    : parent
}

function isSlotTemplate(
  node: RootNode | TemplateChildNode,
): node is TemplateNode {
  return isTemplateNode(node) && !!findDir(node, 'slot', true)
}

function injectFallthroughAttrs(
  node: RootNode | TemplateChildNode,
  attrs: string,
) {
  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.ELEMENT ||
      node.tagType === ElementTypes.COMPONENT) &&
    !findDir(node, 'for')
  ) {
    const bind: DirectiveNode = {
      type: NodeTypes.DIRECTIVE,
      name: 'bind',
      arg: undefined,
      exp: createSimpleExpression(attrs, false),
      modifiers: [],
      loc: locStub,
    }
    node.props.push(bind)
    if (attrs === `_slotAttrs`) slotAttrsBinds.set(node, bind)
  }
}
