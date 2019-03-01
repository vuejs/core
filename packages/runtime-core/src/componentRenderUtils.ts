import { VNode, createFragment, createTextVNode, cloneVNode } from './vdom'
import { ComponentInstance, FunctionalComponent } from './component'
import { resolveProps } from './componentProps'
import { handleError, ErrorTypes } from './errorHandling'
import { VNodeFlags, ChildrenFlags } from './flags'
import { EMPTY_OBJ, isArray, isObject } from '@vue/shared'

export let isRendering = false

export function renderInstanceRoot(instance: ComponentInstance): VNode {
  let vnode
  const { render, $proxy, $props, $slots, $attrs, $parentVNode } = instance
  if (__DEV__) {
    isRendering = true
  }
  try {
    vnode = render.call($proxy, $props, $slots, $attrs, $parentVNode)
  } catch (err) {
    if (__DEV__) {
      isRendering = false
    }
    handleError(err, instance, ErrorTypes.RENDER)
  }
  if (__DEV__) {
    isRendering = false
  }
  return normalizeComponentRoot(vnode, $parentVNode)
}

export function renderFunctionalRoot(vnode: VNode): VNode {
  const render = vnode.tag as FunctionalComponent
  const { 0: props, 1: attrs } = resolveProps(vnode.data, render.props)
  let subTree
  try {
    subTree = render(props, vnode.slots || EMPTY_OBJ, attrs, vnode)
  } catch (err) {
    handleError(err, vnode, ErrorTypes.RENDER)
  }
  return normalizeComponentRoot(subTree, vnode)
}

function normalizeComponentRoot(
  vnode: any,
  componentVNode: VNode | null
): VNode {
  if (vnode == null) {
    vnode = createTextVNode('')
  } else if (!isObject(vnode)) {
    vnode = createTextVNode(vnode + '')
  } else if (isArray(vnode)) {
    if (vnode.length === 1) {
      vnode = normalizeComponentRoot(vnode[0], componentVNode)
    } else {
      vnode = createFragment(vnode)
    }
  } else {
    const { el, flags } = vnode
    if (
      componentVNode &&
      (flags & VNodeFlags.COMPONENT || flags & VNodeFlags.ELEMENT)
    ) {
      if (el) {
        vnode = cloneVNode(vnode as VNode)
      }
      if (flags & VNodeFlags.COMPONENT) {
        vnode.parentVNode = componentVNode
      }
    } else if (el) {
      vnode = cloneVNode(vnode as VNode)
    }
  }
  return vnode
}

export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode
): boolean {
  const { data: prevProps, childFlags: prevChildFlags } = prevVNode
  const { data: nextProps, childFlags: nextChildFlags } = nextVNode
  // If has different slots content, or has non-compiled slots,
  // the child needs to be force updated.
  if (
    prevChildFlags !== nextChildFlags ||
    (nextChildFlags & ChildrenFlags.DYNAMIC_SLOTS) > 0
  ) {
    return true
  }
  if (prevProps === nextProps) {
    return false
  }
  if (prevProps === null) {
    return nextProps !== null
  }
  if (nextProps === null) {
    return prevProps !== null
  }
  const nextKeys = Object.keys(nextProps)
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i]
    if (nextProps[key] !== prevProps[key]) {
      return true
    }
  }
  return false
}

// DEV only
export function getReasonForComponentUpdate(
  prevVNode: VNode,
  nextVNode: VNode
): any {
  const reasons = []
  const { childFlags: prevChildFlags } = prevVNode
  const { childFlags: nextChildFlags } = nextVNode
  if (
    prevChildFlags !== nextChildFlags ||
    (nextChildFlags & ChildrenFlags.DYNAMIC_SLOTS) > 0
  ) {
    reasons.push({
      type: `slots may have changed`,
      tip: `use function slots + $stable: true to avoid slot-triggered child updates.`
    })
  }
  const prevProps = prevVNode.data || EMPTY_OBJ
  const nextProps = nextVNode.data || EMPTY_OBJ
  for (const key in nextProps) {
    if (nextProps[key] !== prevProps[key]) {
      reasons.push({
        type: 'prop changed',
        key,
        value: nextProps[key],
        oldValue: prevProps[key]
      })
    }
  }
  for (const key in prevProps) {
    if (!(key in nextProps)) {
      reasons.push({
        type: 'prop changed',
        key,
        value: undefined,
        oldValue: prevProps[key]
      })
    }
  }
  return {
    type: 'triggered by parent',
    reasons
  }
}
