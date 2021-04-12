import {
  extend,
  isArray,
  isObject,
  normalizeClass,
  normalizeStyle,
  ShapeFlags,
  toHandlerKey
} from '@vue/shared'
import {
  Component,
  ComponentInternalInstance,
  ComponentOptions,
  Data,
  InternalRenderFunction
} from '../component'
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
import { checkCompatEnabled } from './compatConfig'
import { DeprecationTypes } from './deprecations'

export function convertLegacyRenderFn(instance: ComponentInternalInstance) {
  const Component = instance.type as ComponentOptions
  const render = Component.render as InternalRenderFunction | undefined

  // v3 runtime compiled, or already checked / wrapped
  if (!render || render._rc || render._compatChecked || render._compatWrapped) {
    return
  }

  const string = render.toString()
  if (string.startsWith('function render(_ctx') || string.startsWith('(_ctx')) {
    // v3 pre-compiled function
    render._compatChecked = true
    return
  }

  // v2 render function, try to provide compat
  if (checkCompatEnabled(DeprecationTypes.RENDER_FUNCTION, instance)) {
    const wrapped = (Component.render = function compatRender() {
      // @ts-ignore
      return render.call(this, compatH)
    })
    // @ts-ignore
    wrapped._compatWrapped = true
  }
}

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

function convertLegacyProps(
  legacyProps?: LegacyVNodeProps
): Data & VNodeProps | null {
  if (!legacyProps) {
    return null
  }

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
    } else if (
      key !== 'refInFor' &&
      key !== 'staticStyle' &&
      key !== 'staticClass'
    ) {
      converted[key] = legacyProps[key as keyof LegacyVNodeProps]
    }
  }

  if (legacyProps.staticClass) {
    converted.class = normalizeClass([legacyProps.staticClass, converted.class])
  }
  if (legacyProps.staticStyle) {
    converted.style = normalizeStyle([legacyProps.staticStyle, converted.style])
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
