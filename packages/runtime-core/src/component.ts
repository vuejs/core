import { VNode, normalizeVNode, VNodeChild } from './vnode'
import { ReactiveEffect } from '@vue/observer'
import { isFunction } from '@vue/shared'
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

export type ComponentHandle = {
  type: FunctionalComponent | ComponentOptions
  vnode: VNode | null
  next: VNode | null
  subTree: VNode | null
  update: ReactiveEffect
} & ComponentPublicProperties

export function renderComponentRoot(handle: ComponentHandle): VNode {
  const { type, vnode } = handle
  const { 0: props, 1: attrs } = resolveProps(
    (vnode as VNode).props,
    type.props
  )
  const renderArg = {
    state: handle.$state,
    slots: handle.$slots,
    props,
    attrs
  }
  if (isFunction(type)) {
    return normalizeVNode(type(renderArg))
  } else {
    if (__DEV__ && !type.render) {
      // TODO warn missing render
    }
    return normalizeVNode((type.render as Function)(renderArg))
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
