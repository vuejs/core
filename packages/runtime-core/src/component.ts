import { VNode, normalizeVNode, VNodeChild } from './vnode'
import {
  ReactiveEffect,
  UnwrapValue,
  observable,
  immutable
} from '@vue/observer'
import { isFunction, EMPTY_OBJ } from '@vue/shared'
import { RenderProxyHandlers } from './componentProxy'
import { ComponentPropsOptions, PropValidator } from './componentProps'
import { PROPS, SLOTS } from './patchFlags'

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
  renderProxy: ComponentPublicProperties | null
  propsProxy: Data | null
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
    renderProxy: null,
    propsProxy: null,

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
  const proxy = (instance.renderProxy = new Proxy(
    instance,
    RenderProxyHandlers
  ) as any)
  // 2. call setup()
  const { setup } = Component
  if (setup) {
    currentInstance = instance
    // the props proxy makes the props object passed to setup() reactive
    // so props change can be tracked by watchers
    // only need to create it if setup() actually expects it
    // it will be updated in resolveProps() on updates before render
    const propsProxy = (instance.propsProxy = setup.length
      ? immutable(instance.props)
      : null)
    instance.state = observable(setup.call(proxy, propsProxy))
    currentInstance = null
  }
}

export function renderComponentRoot(instance: ComponentInstance): VNode {
  const { type: Component, renderProxy } = instance
  if (isFunction(Component)) {
    return normalizeVNode(Component(instance))
  } else {
    if (__DEV__ && !Component.render) {
      // TODO warn missing render
    }
    return normalizeVNode(
      (Component.render as Function).call(renderProxy, instance)
    )
  }
}

export function shouldUpdateComponent(
  prevVNode: VNode,
  nextVNode: VNode
): boolean {
  const { props: prevProps } = prevVNode
  const { props: nextProps, patchFlag } = nextVNode
  if (patchFlag !== null) {
    if (patchFlag & SLOTS) {
      // slot content that references values that might have changed,
      // e.g. in a v-for
      return true
    }
    if (patchFlag & PROPS) {
      const dynamicProps = nextVNode.dynamicProps as string[]
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i]
        if ((nextProps as any)[key] !== (prevProps as any)[key]) {
          return true
        }
      }
    }
  } else {
    // TODO handle slots
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
  }
  return false
}
