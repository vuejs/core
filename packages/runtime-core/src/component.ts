import { VNode, normalizeVNode, VNodeChild } from './vnode'
import { ReactiveEffect, UnwrapValue, observable } from '@vue/observer'
import { isFunction, EMPTY_OBJ } from '@vue/shared'
import { RenderProxyHandlers } from './componentProxy'
import { ComponentPropsOptions, PropValidator } from './componentProps'

export type Data = { [key: string]: any }

type ExtractPropTypes<PropOptions> = {
  readonly [key in keyof PropOptions]: PropOptions[key] extends PropValidator<
    infer V
  >
    ? V
    : PropOptions[key] extends null | undefined ? any : PropOptions[key]
}

export type ComponentPublicProperties<P = Data, S = Data> = {
  $state: S
  $props: P
  $attrs: Data

  // TODO
  $refs: Data
  $slots: Data

  $root: ComponentInstance | null
  $parent: ComponentInstance | null
} & P &
  S

export interface ComponentOptions<
  RawProps = ComponentPropsOptions,
  RawBindings = Data | void,
  Props = ExtractPropTypes<RawProps>,
  Bindings = UnwrapValue<RawBindings>
> {
  props?: RawProps
  setup?: (props: Props) => RawBindings
  render?: <State extends Bindings>(
    this: ComponentPublicProperties<Props, State>,
    ctx: ComponentInstance<Props, State>
  ) => VNodeChild
}

export interface FunctionalComponent<P = {}> {
  (ctx: ComponentInstance<P>): any
  props?: ComponentPropsOptions<P>
  displayName?: string
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

export type Slot = (...args: any[]) => VNode[]

export type Slots = Readonly<{
  [name: string]: Slot
}>

export type ComponentInstance<P = Data, S = Data> = {
  type: FunctionalComponent | ComponentOptions
  vnode: VNode
  next: VNode | null
  subTree: VNode
  update: ReactiveEffect
  effects: ReactiveEffect[] | null
  // the rest are only for stateful components
  proxy: ComponentPublicProperties | null
  state: S
  props: P
  attrs: Data
  slots: Slots
  refs: Data
} & LifecycleHooks

// no-op, for type inference only
export function createComponent<
  RawProps,
  RawBindings,
  Props = ExtractPropTypes<RawProps>,
  Bindings = UnwrapValue<RawBindings>
>(
  options: ComponentOptions<RawProps, RawBindings, Props, Bindings>
): {
  // for TSX
  new (): { $props: Props }
} {
  return options as any
}

export function createComponentInstance(type: any): ComponentInstance {
  return {
    type,
    vnode: null as any,
    next: null,
    subTree: null as any,
    update: null as any,
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
    effects: null,

    // public properties
    state: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ
  }
}

export let currentInstance: ComponentInstance | null = null

export function setupStatefulComponent(instance: ComponentInstance) {
  const Component = instance.type as ComponentOptions
  // 1. create render proxy
  const proxy = (instance.proxy = new Proxy(
    instance,
    RenderProxyHandlers
  ) as any)
  // 2. call setup()
  if (Component.setup) {
    currentInstance = instance
    // TODO should pass reactive props here
    instance.state = observable(Component.setup.call(proxy, instance.props))
    currentInstance = null
  }
}

export function renderComponentRoot(instance: ComponentInstance): VNode {
  const { type: Component, proxy } = instance
  if (isFunction(Component)) {
    return normalizeVNode(Component(instance))
  } else {
    if (__DEV__ && !Component.render) {
      // TODO warn missing render
    }
    return normalizeVNode((Component.render as Function).call(proxy, instance))
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
