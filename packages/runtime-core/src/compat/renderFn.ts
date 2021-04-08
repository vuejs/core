import { isArray, isObject } from '@vue/shared'
import { Component, Data } from '../component'
import {
  createVNode,
  isVNode,
  VNode,
  VNodeArrayChildren,
  VNodeProps
} from '../vnode'

interface LegacyVNodeProps {
  key?: string | number
  ref?: string
  refInFor?: boolean

  staticClass?: string
  class?: unknown
  staticStyle?: Record<string, unknown>
  style?: Record<string, unknown>
  attrs?: Record<string, unknown>
  domProps?: Record<string, unknown>
  on?: Record<string, Function | Function[]>
  nativeOn?: Record<string, Function | Function[]>
  directives?: LegacyVNodeDirective[]

  slot?: string
  scopedSlots?: Record<string, Function>
}

interface LegacyVNodeDirective {
  name: string
  value: unknown
  arg?: string
  modifiers?: Record<string, boolean>
}

type LegacyVNodeChildren =
  | string
  | number
  | boolean
  | VNode
  | VNodeArrayChildren

export function h(
  type: string | Component,
  children?: LegacyVNodeChildren
): VNode
export function h(
  type: string | Component,
  props?: LegacyVNodeProps,
  children?: LegacyVNodeChildren
): VNode

export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  const l = arguments.length
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // single vnode without props
      if (isVNode(propsOrChildren)) {
        return convertLegacySlots(createVNode(type, null, [propsOrChildren]))
      }
      // props without children
      return convertLegacyDirectives(
        createVNode(type, convertLegacyProps(propsOrChildren)),
        propsOrChildren
      )
    } else {
      // omit props
      return convertLegacySlots(createVNode(type, null, propsOrChildren))
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return convertLegacySlots(
      convertLegacyDirectives(
        createVNode(type, convertLegacyProps(propsOrChildren), children),
        propsOrChildren
      )
    )
  }
}

function convertLegacyProps(props: LegacyVNodeProps): Data & VNodeProps {
  // TODO
  return {}
}

function convertLegacyDirectives(vnode: VNode, props: LegacyVNodeProps): VNode {
  // TODO
  return vnode
}

function convertLegacySlots(vnode: VNode): VNode {
  // TODO
  return vnode
}
