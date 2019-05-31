import { VNode, normalizeVNode, VNodeChild } from './vnode'
import {
  ReactiveEffect,
  UnwrapValue,
  observable,
  immutable
} from '@vue/observer'
import { isFunction, EMPTY_OBJ } from '@vue/shared'
import { RenderProxyHandlers } from './componentProxy'
import { ComponentPropsOptions, ExtractPropTypes } from './componentProps'
import { PROPS, DYNAMIC_SLOTS, FULL_PROPS } from './patchFlags'
import { Slots } from './componentSlots'

export type Data = { [key: string]: any }

export type ComponentPublicProperties<P = {}, S = {}> = {
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

interface ComponentOptions<
  RawProps = ComponentPropsOptions,
  RawBindings = Data,
  Props = ExtractPropTypes<RawProps>,
  ExposedProps = RawProps extends object ? Props : {}
> {
  props?: RawProps
  setup?: (this: ComponentPublicProperties, props: Props) => RawBindings
  render?: <State extends UnwrapValue<RawBindings>>(
    this: ComponentPublicProperties<ExposedProps, State>,
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
export function createComponent<RawProps, RawBindings>(
  options: ComponentOptions<RawProps, RawBindings>
): {
  // for TSX
  new (): { $props: ExtractPropTypes<RawProps> }
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
  nextVNode: VNode,
  optimized?: boolean
): boolean {
  const { props: prevProps, children: prevChildren } = prevVNode
  const { props: nextProps, children: nextChildren, patchFlag } = nextVNode
  if (patchFlag !== null) {
    if (patchFlag & DYNAMIC_SLOTS) {
      // slot content that references values that might have changed,
      // e.g. in a v-for
      return true
    }
    if (patchFlag & FULL_PROPS) {
      // presence of this flag indicates props are always non-null
      return hasPropsChanged(prevProps as Data, nextProps as Data)
    } else if (patchFlag & PROPS) {
      const dynamicProps = nextVNode.dynamicProps as string[]
      for (let i = 0; i < dynamicProps.length; i++) {
        const key = dynamicProps[i]
        if ((nextProps as any)[key] !== (prevProps as any)[key]) {
          return true
        }
      }
    }
  } else if (!optimized) {
    // this path is only taken by manually written render functions
    // so presence of any children leads to a forced update
    if (prevChildren != null || nextChildren != null) {
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
    return hasPropsChanged(prevProps, nextProps)
  }
  return false
}

function hasPropsChanged(prevProps: Data, nextProps: Data): boolean {
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
