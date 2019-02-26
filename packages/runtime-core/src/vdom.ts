import {
  ComponentInstance,
  ComponentClass,
  FunctionalComponent
} from './component'
import { VNodeFlags, ChildrenFlags } from './flags'
import { createComponentClassFromOptions } from './componentOptions'
import { EMPTY_OBJ, isObject, isArray, isFunction, isString } from '@vue/shared'
import { RawChildrenType, RawSlots } from './h'
import { FunctionalHandle } from './createRenderer'

const handlersRE = /^on|^vnode/
const STABLE_SLOTS_HINT = '$stable'

// Vue core is platform agnostic, so we are not using Element for "DOM" nodes.
export interface RenderNode {
  vnode?: VNode | null
  // technically this doesn't exist on platform render nodes,
  // but we list it here so that TS can figure out union types
  $f: false
}

export interface VNode {
  _isVNode: true
  flags: VNodeFlags
  tag: string | FunctionalComponent | ComponentClass | RenderNode | null
  data: VNodeData | null
  children: VNodeChildren
  childFlags: ChildrenFlags
  key: Key | null
  ref: Ref | null
  slots: Slots | null
  // only on mounted nodes
  el: RenderNode | null
  // only on mounted component nodes that is also a root node (HOCs)
  // points to parent component's placeholder vnode
  // this is used to update vnode.el for nested HOCs.
  parentVNode: VNode | null
  // only on mounted component nodes
  // points to the parent stateful/functional component's placeholder node
  contextVNode: VNode | null
  // only on mounted functional component nodes
  // a consistent handle so that a functional component can be identified
  // by the scheduler
  handle: FunctionalHandle | null
  // only on cloned vnodes, points to the original cloned vnode
  clonedFrom: VNode | null
}

export interface MountedVNode extends VNode {
  el: RenderNode
}

export interface BuiltInProps {
  key?: Key | null
  ref?: Ref | null
  slots?: RawSlots | null
}

export type VNodeData = {
  [key: string]: any
} & BuiltInProps

export type VNodeChildren =
  | VNode[] // ELEMENT | PORTAL
  | ComponentInstance // COMPONENT_STATEFUL
  | VNode // COMPONENT_FUNCTIONAL
  | string // TEXT
  | null

export type Key = string | number

export type Ref = (t: RenderNode | ComponentInstance | null) => void

export type Slot = (...args: any[]) => VNode[]

export type Slots = Readonly<{
  [name: string]: Slot
}>

export function createVNode(
  flags: VNodeFlags,
  tag: string | FunctionalComponent | ComponentClass | RenderNode | null,
  data: VNodeData | null,
  children: RawChildrenType | null,
  childFlags: ChildrenFlags,
  key: Key | null | undefined,
  ref: Ref | null | undefined,
  slots: Slots | null | undefined
): VNode {
  const vnode: VNode = {
    _isVNode: true,
    flags,
    tag,
    data,
    children: children as VNodeChildren,
    childFlags,
    key: key === void 0 ? null : key,
    ref: ref === void 0 ? null : ref,
    slots: slots === void 0 ? null : slots,
    el: null,
    parentVNode: null,
    contextVNode: null,
    handle: null,
    clonedFrom: null
  }
  if (childFlags === ChildrenFlags.UNKNOWN_CHILDREN) {
    normalizeChildren(vnode, children)
  }
  return vnode
}

export function createElementVNode(
  tag: string,
  data: VNodeData | null,
  children: RawChildrenType | null,
  childFlags: ChildrenFlags,
  key?: Key | null,
  ref?: Ref | null
) {
  const flags = tag === 'svg' ? VNodeFlags.ELEMENT_SVG : VNodeFlags.ELEMENT_HTML
  if (data !== null) {
    normalizeClassAndStyle(data)
  }
  return createVNode(flags, tag, data, children, childFlags, key, ref, null)
}

function normalizeClassAndStyle(data: VNodeData) {
  if (data.class != null) {
    data.class = normalizeClass(data.class)
  }
  if (data.style != null) {
    data.style = normalizeStyle(data.style)
  }
}

function normalizeStyle(value: any): Record<string, string | number> | void {
  if (isArray(value)) {
    const res: Record<string, string | number> = {}
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeStyle(value[i])
      if (normalized) {
        for (const key in normalized) {
          res[key] = normalized[key]
        }
      }
    }
    return res
  } else if (isObject(value)) {
    return value
  }
}

function normalizeClass(value: any): string {
  let res = ''
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      res += normalizeClass(value[i]) + ' '
    }
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        res += name + ' '
      }
    }
  }
  return res.trim()
}

export function createComponentVNode(
  comp: any,
  data: VNodeData | null,
  children: RawChildrenType | Slots,
  childFlags: ChildrenFlags,
  key?: Key | null,
  ref?: Ref | null
) {
  // resolve type
  let flags: VNodeFlags

  // flags
  if (isObject(comp)) {
    if (comp.functional) {
      // object literal functional
      flags = VNodeFlags.COMPONENT_FUNCTIONAL
      const { render } = comp
      if (!comp._normalized) {
        render.pure = comp.pure
        render.props = comp.props
        comp._normalized = true
      }
      comp = render
    } else {
      // object literal stateful
      flags = VNodeFlags.COMPONENT_STATEFUL_NORMAL
      comp =
        comp._normalized ||
        (comp._normalized = createComponentClassFromOptions(comp))
    }
  } else {
    // assumes comp is function here now
    if (__DEV__ && !isFunction(comp)) {
      // TODO warn invalid comp value in dev
    }
    if (comp.prototype && comp.prototype.render) {
      flags = VNodeFlags.COMPONENT_STATEFUL_NORMAL
    } else {
      flags = VNodeFlags.COMPONENT_FUNCTIONAL
    }
  }

  if (__DEV__ && flags === VNodeFlags.COMPONENT_FUNCTIONAL && ref) {
    // TODO warn functional component cannot have ref
  }

  // slots
  let slots: any
  if (childFlags === ChildrenFlags.STABLE_SLOTS) {
    slots = children
  } else if (childFlags === ChildrenFlags.UNKNOWN_CHILDREN) {
    childFlags = children
      ? ChildrenFlags.DYNAMIC_SLOTS
      : ChildrenFlags.NO_CHILDREN
    if (children != null) {
      if (isFunction(children)) {
        // function as children
        slots = { default: children }
      } else if (isObject(children) && !(children as any)._isVNode) {
        // slot object as children
        slots = children
        // special manual optimization hint for raw render fn users
        if (slots[STABLE_SLOTS_HINT]) {
          childFlags = ChildrenFlags.STABLE_SLOTS
        }
      } else {
        slots = { default: () => children }
      }
      slots = normalizeSlots(slots)
    }
  }

  // class & style
  if (data !== null) {
    normalizeClassAndStyle(data)
  }

  return createVNode(
    flags,
    comp,
    data,
    null, // to be set during mount
    childFlags,
    key,
    ref,
    slots
  )
}

export function createTextVNode(text: string): VNode {
  return createVNode(
    VNodeFlags.TEXT,
    null,
    null,
    text == null ? '' : text,
    ChildrenFlags.NO_CHILDREN,
    null,
    null,
    null
  )
}

export function createFragment(
  children: RawChildrenType,
  childFlags?: ChildrenFlags,
  key?: Key | null
) {
  return createVNode(
    VNodeFlags.FRAGMENT,
    null,
    null,
    children,
    childFlags === void 0 ? ChildrenFlags.UNKNOWN_CHILDREN : childFlags,
    key,
    null,
    null
  )
}

export function createPortal(
  target: RenderNode | string,
  children: RawChildrenType,
  childFlags?: ChildrenFlags,
  key?: Key | null,
  ref?: Ref | null
): VNode {
  return createVNode(
    VNodeFlags.PORTAL,
    target,
    null,
    children,
    childFlags === void 0 ? ChildrenFlags.UNKNOWN_CHILDREN : childFlags,
    key,
    ref,
    null
  )
}

export function cloneVNode(vnode: VNode, extraData?: VNodeData): VNode {
  const { flags, data } = vnode
  if (flags & VNodeFlags.ELEMENT || flags & VNodeFlags.COMPONENT) {
    let clonedData = data
    if (extraData != null) {
      clonedData = {}
      if (data != null) {
        for (const key in data) {
          clonedData[key] = data[key]
        }
      }
      if (extraData !== EMPTY_OBJ) {
        for (const key in extraData) {
          if (key === 'class') {
            clonedData.class = normalizeClass([
              clonedData.class,
              extraData.class
            ])
          } else if (key === 'style') {
            clonedData.style = normalizeStyle([
              clonedData.style,
              extraData.style
            ])
          } else if (handlersRE.test(key)) {
            // on*, vnode*
            const existing = clonedData[key]
            clonedData[key] = existing
              ? [].concat(existing, extraData[key])
              : extraData[key]
          } else {
            clonedData[key] = extraData[key]
          }
        }
      }
    }
    const cloned = createVNode(
      flags,
      vnode.tag,
      clonedData,
      vnode.children as RawChildrenType,
      vnode.childFlags,
      vnode.key,
      vnode.ref,
      vnode.slots
    )
    cloned.clonedFrom = vnode.clonedFrom || vnode
    return cloned
  } else if (flags & VNodeFlags.TEXT) {
    return createTextVNode(vnode.children as string)
  } else {
    return vnode
  }
}

function normalizeChildren(vnode: VNode, children: any) {
  let childFlags
  if (isArray(children)) {
    const { length } = children
    if (length === 0) {
      childFlags = ChildrenFlags.NO_CHILDREN
      children = null
    } else if (length === 1) {
      childFlags = ChildrenFlags.SINGLE_VNODE
      children = children[0]
      if (children.el) {
        children = cloneVNode(children)
      }
    } else {
      childFlags = ChildrenFlags.KEYED_VNODES
      children = normalizeVNodes(children)
    }
  } else if (children == null) {
    childFlags = ChildrenFlags.NO_CHILDREN
  } else if (children._isVNode) {
    childFlags = ChildrenFlags.SINGLE_VNODE
    if (children.el) {
      children = cloneVNode(children)
    }
  } else {
    // primitives or invalid values, cast to string
    childFlags = ChildrenFlags.SINGLE_VNODE
    children = createTextVNode(children + '')
  }
  vnode.children = children
  vnode.childFlags = childFlags
}

export function normalizeVNodes(
  children: any[],
  newChildren: VNode[] = [],
  currentPrefix: string = ''
): VNode[] {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    let newChild
    if (child == null) {
      newChild = createTextVNode('')
    } else if (child._isVNode) {
      newChild = child.el ? cloneVNode(child) : child
    } else if (isArray(child)) {
      normalizeVNodes(child, newChildren, currentPrefix + i + '|')
    } else {
      newChild = createTextVNode(child + '')
    }
    if (newChild) {
      if (newChild.key == null) {
        newChild.key = currentPrefix + i
      }
      newChildren.push(newChild)
    }
  }
  return newChildren
}

// ensure all slot functions return Arrays
function normalizeSlots(slots: { [name: string]: any }): Slots {
  if (slots._normalized) {
    return slots
  }
  const normalized = { _normalized: true } as any
  for (const name in slots) {
    if (name === STABLE_SLOTS_HINT) {
      continue
    }
    normalized[name] = (...args: any[]) => normalizeSlot(slots[name](...args))
  }
  return normalized
}

function normalizeSlot(value: any): VNode[] {
  if (value == null) {
    return [createTextVNode('')]
  } else if (isArray(value)) {
    return normalizeVNodes(value)
  } else if (value._isVNode) {
    return [value]
  } else {
    return [createTextVNode(value + '')]
  }
}
