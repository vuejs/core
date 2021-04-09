import {
  extend,
  isArray,
  isObject,
  ShapeFlags,
  toHandlerKey
} from '@vue/shared'
import { Component, Data } from '../component'
import { DirectiveArguments, withDirectives } from '../directives'
import {
  resolveDirective,
  resolveDynamicComponent
} from '../helpers/resolveAssets'
import {
  createVNode,
  isVNode,
  normalizeChildren,
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

  // component only
  props?: Record<string, unknown>
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

export function compatH(
  type: string | Component,
  children?: LegacyVNodeChildren
): VNode
export function compatH(
  type: string | Component,
  props?: LegacyVNodeProps,
  children?: LegacyVNodeChildren
): VNode

export function compatH(
  type: any,
  propsOrChildren?: any,
  children?: any
): VNode {
  // to support v2 string component name lookup
  type = resolveDynamicComponent(type)

  const l = arguments.length
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // single vnode without props
      if (isVNode(propsOrChildren)) {
        return convertLegacySlots(createVNode(type, null, [propsOrChildren]))
      }
      // props without children
      return convertLegacySlots(
        convertLegacyDirectives(
          createVNode(type, convertLegacyProps(propsOrChildren)),
          propsOrChildren
        )
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

function convertLegacyProps(legacyProps?: LegacyVNodeProps): Data & VNodeProps {
  const converted: Data & VNodeProps = {}

  for (const key in legacyProps) {
    if (key === 'attrs' || key === 'domProps' || key === 'props') {
      extend(converted, legacyProps[key])
    } else if (key === 'on' || key === 'nativeOn') {
      const listeners = legacyProps[key]
      for (const event in listeners) {
        const handlerKey = toHandlerKey(event)
        const existing = converted[handlerKey]
        const incoming = listeners[event]
        if (existing !== incoming) {
          converted[handlerKey] = existing
            ? [].concat(existing as any, incoming as any)
            : incoming
        }
      }
    } else {
      converted[key] = legacyProps[key as keyof LegacyVNodeProps]
    }
  }

  return converted
}

function convertLegacyDirectives(
  vnode: VNode,
  props?: LegacyVNodeProps
): VNode {
  if (props && props.directives) {
    return withDirectives(
      vnode,
      props.directives.map(({ name, value, arg, modifiers }) => {
        return [
          resolveDirective(name)!,
          value,
          arg,
          modifiers
        ] as DirectiveArguments[number]
      })
    )
  }
  return vnode
}

function convertLegacySlots(vnode: VNode): VNode {
  const { props, children } = vnode

  let slots: Record<string, any> | undefined

  if (vnode.shapeFlag & ShapeFlags.COMPONENT && isArray(children)) {
    slots = {}
    // check "slot" property on vnodes and turn them into v3 function slots
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      const slotName =
        (isVNode(child) && child.props && child.props.slot) || 'default'
      ;(slots[slotName] || (slots[slotName] = [] as any[])).push(child)
    }
    if (slots) {
      for (const key in slots) {
        const slotChildren = slots[key]
        slots[key] = () => slotChildren
      }
    }
  }

  const scopedSlots = props && props.scopedSlots
  if (scopedSlots) {
    delete props!.scopedSlots
    if (slots) {
      extend(slots, scopedSlots)
    } else {
      slots = scopedSlots
    }
  }

  if (slots) {
    normalizeChildren(vnode, slots)
  }

  return vnode
}
