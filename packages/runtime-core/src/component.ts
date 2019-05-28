import { VNode, normalizeVNode, VNodeChild } from './vnode'
import { ReactiveEffect } from '@vue/observer'
import { isFunction, EMPTY_OBJ } from '@vue/shared'
import { resolveProps, ComponentPropsOptions } from './componentProps'

interface Value<T> {
  value: T
}

type UnwrapBindings<T> = {
  [key in keyof T]: T[key] extends Value<infer V> ? V : T[key]
}

type Prop<T> = { (): T } | { new (...args: any[]): T & object }

type ExtractPropTypes<PropOptions> = {
  readonly [key in keyof PropOptions]: PropOptions[key] extends Prop<infer V>
    ? V
    : PropOptions[key] extends null | undefined ? any : PropOptions[key]
}

export type Data = { [key: string]: any }

export interface ComponentPublicProperties<P = Data, S = Data> {
  $state: S
  $props: P
  $attrs: Data

  // TODO
  $refs: Data
  $slots: Data
}

interface RenderFunctionArg<B = Data, P = Data> {
  state: B
  props: P
  attrs: Data
  slots: Slots
}

export interface ComponentOptions<
  RawProps = ComponentPropsOptions,
  RawBindings = Data | void,
  Props = ExtractPropTypes<RawProps>,
  Bindings = UnwrapBindings<RawBindings>
> {
  props?: RawProps
  setup?: (props: Props) => RawBindings
  render?: <B extends Bindings>(
    this: ComponentPublicProperties<Props, B>,
    ctx: RenderFunctionArg<B, Props>
  ) => VNodeChild
}

export interface FunctionalComponent<P = {}> {
  (ctx: RenderFunctionArg): any
  props?: ComponentPropsOptions<P>
  displayName?: string
}

export type Slot = (...args: any[]) => VNode[]

export type Slots = Readonly<{
  [name: string]: Slot
}>

// no-op, for type inference only
export function createComponent<
  RawProps,
  RawBindings,
  Props = ExtractPropTypes<RawProps>,
  Bindings = UnwrapBindings<RawBindings>
>(
  options: ComponentOptions<RawProps, RawBindings, Props, Bindings>
): {
  // for TSX
  new (): { $props: Props }
} {
  return options as any
}

type LifecycleHook = Function[] | null

export interface LifecycleHooks {
  bm: LifecycleHook // beforeMount
  m: LifecycleHook // mounted
  bu: LifecycleHook // beforeUpdate
  u: LifecycleHook // updated
  bum: LifecycleHook // beforeUnmount
  um: LifecycleHook // unmounted
  da: LifecycleHook // deactivated
  a: LifecycleHook // activated
  rtg: LifecycleHook // renderTriggered
  rtc: LifecycleHook // renderTracked
  ec: LifecycleHook // errorCaptured
}

export type ComponentInstance = {
  type: FunctionalComponent | ComponentOptions
  vnode: VNode | null
  next: VNode | null
  subTree: VNode | null
  update: ReactiveEffect
  bindings: Data | null
  proxy: Data | null
} & LifecycleHooks &
  ComponentPublicProperties

export function createComponentInstance(vnode: VNode): ComponentInstance {
  const type = vnode.type as any
  const instance = {
    type,
    vnode: null,
    next: null,
    subTree: null,
    update: null as any,
    bindings: null,
    proxy: null,

    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,

    // public properties
    $attrs: EMPTY_OBJ,
    $props: EMPTY_OBJ,
    $refs: EMPTY_OBJ,
    $slots: EMPTY_OBJ,
    $state: EMPTY_OBJ
  }
  if (typeof type === 'object' && type.setup) {
    setupStatefulComponent(instance)
  }
  return instance
}

export let currentInstance: ComponentInstance | null = null

const RenderProxyHandlers = {}

export function setupStatefulComponent(instance: ComponentInstance) {
  // 1. create render proxy
  const proxy = (instance.proxy = new Proxy(instance, RenderProxyHandlers))
  // 2. resolve initial props
  // 3. call setup()
  const type = instance.type as ComponentOptions
  if (type.setup) {
    currentInstance = instance
    instance.bindings = type.setup.call(proxy, proxy)
    currentInstance = null
  }
}

export function renderComponentRoot(instance: ComponentInstance): VNode {
  const { type, vnode, proxy, $state, $slots } = instance
  if (!type) debugger
  const { 0: props, 1: attrs } = resolveProps(
    (vnode as VNode).props,
    type.props
  )
  const renderArg = {
    state: $state,
    slots: $slots,
    props,
    attrs
  }
  if (isFunction(type)) {
    return normalizeVNode(type(renderArg))
  } else {
    if (__DEV__ && !type.render) {
      // TODO warn missing render
    }
    return normalizeVNode((type.render as Function).call(proxy, renderArg))
  }
}

export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode
): boolean {
  const { props: prevProps } = prevVNode
  const { props: nextProps } = nextVNode

  // TODO handle slots
  // If has different slots content, or has non-compiled slots,
  // the child needs to be force updated.
  // if (
  //   prevChildFlags !== nextChildFlags ||
  //   (nextChildFlags & ChildrenFlags.DYNAMIC_SLOTS) > 0
  // ) {
  //   return true
  // }

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
