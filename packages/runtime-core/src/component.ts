import { VNode, normalizeVNode, VNodeChild } from './vnode'
import {
  ReactiveEffect,
  UnwrapValue,
  state,
  immutableState
} from '@vue/reactivity'
import { EMPTY_OBJ, isFunction } from '@vue/shared'
import { RenderProxyHandlers } from './componentProxy'
import { ComponentPropsOptions, ExtractPropTypes } from './componentProps'
import { PROPS, DYNAMIC_SLOTS, FULL_PROPS } from './patchFlags'
import { Slots } from './componentSlots'
import { STATEFUL_COMPONENT } from './typeFlags'

export type Data = { [key: string]: any }

// public properties exposed on the proxy, which is used as the render context
// in templates (as `this` in the render option)
export type ComponentRenderProxy<P = {}, S = {}, PublicProps = P> = {
  $state: S
  $props: PublicProps
  $attrs: Data
  $refs: Data
  $slots: Data
  $root: ComponentInstance | null
  $parent: ComponentInstance | null
} & P &
  S

type RenderFunction<P = Data> = (
  props: P,
  slots: Slots,
  attrs: Data,
  vnode: VNode
) => any

type RenderFunctionWithThis<Props, RawBindings> = <
  Bindings extends UnwrapValue<RawBindings>
>(
  this: ComponentRenderProxy<Props, Bindings>,
  props: Props,
  slots: Slots,
  attrs: Data,
  vnode: VNode
) => VNodeChild

interface ComponentOptionsWithoutProps<Props = Data, RawBindings = Data> {
  props?: undefined
  setup?: (
    this: ComponentRenderProxy<Props>,
    props: Props
  ) => RawBindings | RenderFunction<Props>
  render?: RenderFunctionWithThis<Props, RawBindings>
}

interface ComponentOptionsWithArrayProps<
  PropNames extends string = string,
  RawBindings = Data,
  Props = { [key in PropNames]?: any }
> {
  props: PropNames[]
  setup?: (
    this: ComponentRenderProxy<Props>,
    props: Props
  ) => RawBindings | RenderFunction<Props>
  render?: RenderFunctionWithThis<Props, RawBindings>
}

interface ComponentOptionsWithProps<
  PropsOptions = ComponentPropsOptions,
  RawBindings = Data,
  Props = ExtractPropTypes<PropsOptions>
> {
  props: PropsOptions
  setup?: (
    this: ComponentRenderProxy<Props>,
    props: Props
  ) => RawBindings | RenderFunction<Props>
  render?: RenderFunctionWithThis<Props, RawBindings>
}

export type ComponentOptions =
  | ComponentOptionsWithProps
  | ComponentOptionsWithoutProps
  | ComponentOptionsWithArrayProps

export interface FunctionalComponent<P = {}> extends RenderFunction<P> {
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
  parent: ComponentInstance | null
  root: ComponentInstance
  vnode: VNode
  next: VNode | null
  subTree: VNode
  update: ReactiveEffect
  effects: ReactiveEffect[] | null
  render: RenderFunction<P> | null
  // the rest are only for stateful components
  renderProxy: ComponentRenderProxy | null
  propsProxy: Data | null
  state: S
  props: P
  attrs: Data
  slots: Slots
  refs: Data
} & LifecycleHooks

// createComponent
// overload 1: direct setup function
// (uses user defined props interface)
export function createComponent<Props>(
  setup: (props: Props) => RenderFunction<Props>
): (props: Props) => any
// overload 2: object format with no props
// (uses user defined props interface)
// return type is for Vetur and TSX support
export function createComponent<Props, RawBindings>(
  options: ComponentOptionsWithoutProps<Props, RawBindings>
): {
  new (): ComponentRenderProxy<Props, UnwrapValue<RawBindings>>
}
// overload 3: object format with array props declaration
// props inferred as { [key in PropNames]?: any }
// return type is for Vetur and TSX support
export function createComponent<PropNames extends string, RawBindings>(
  options: ComponentOptionsWithArrayProps<PropNames, RawBindings>
): {
  new (): ComponentRenderProxy<
    { [key in PropNames]?: any },
    UnwrapValue<RawBindings>
  >
}
// overload 4: object format with object props declaration
// see `ExtractPropTypes` in ./componentProps.ts
export function createComponent<PropsOptions, RawBindings>(
  options: ComponentOptionsWithProps<PropsOptions, RawBindings>
): {
  // for Vetur and TSX support
  new (): ComponentRenderProxy<
    ExtractPropTypes<PropsOptions>,
    UnwrapValue<RawBindings>,
    ExtractPropTypes<PropsOptions, false>
  >
}
// implementation, close to no-op
export function createComponent(options: any) {
  return isFunction(options) ? { setup: options } : (options as any)
}

export function createComponentInstance(
  type: any,
  parent: ComponentInstance | null
): ComponentInstance {
  const instance = {
    type,
    parent,
    root: null as any, // set later so it can point to itself
    vnode: null as any,
    next: null,
    subTree: null as any,
    update: null as any,
    render: null,
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

  instance.root = parent ? parent.root : instance
  return instance
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
      ? immutableState(instance.props)
      : null)
    const setupResult = setup.call(proxy, propsProxy)
    if (isFunction(setupResult)) {
      // setup returned an inline render function
      instance.render = setupResult
    } else {
      // setup returned bindings.
      // assuming a render function compiled from template is present.
      instance.state = state(setupResult)
      if (__DEV__ && !Component.render) {
        // TODO warn missing render fn
      }
      instance.render = Component.render as RenderFunction
    }
    currentInstance = null
  }
}

export function renderComponentRoot(instance: ComponentInstance): VNode {
  const { type: Component, renderProxy, props, slots, attrs, vnode } = instance
  if (vnode.shapeFlag & STATEFUL_COMPONENT) {
    return normalizeVNode(
      (instance.render as RenderFunction).call(
        renderProxy,
        props,
        slots,
        attrs,
        vnode
      )
    )
  } else {
    // functional
    return normalizeVNode(
      (Component as FunctionalComponent)(props, slots, attrs, vnode)
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
  if (patchFlag) {
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
