import { VNode, normalizeVNode, VNodeChild } from './vnode'
import { ReactiveEffect } from '@vue/observer'
import { isFunction, EMPTY_OBJ } from '@vue/shared'

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

interface ComponentPublicProperties<P, S> {
  $props: P
  $state: S
}

export interface ComponentOptions<
  RawProps = { [key: string]: Prop<any> },
  RawBindings = { [key: string]: any } | void,
  Props = ExtractPropTypes<RawProps>,
  Bindings = UnwrapBindings<RawBindings>
> {
  props?: RawProps
  setup?: (props: Props) => RawBindings
  render?: <B extends Bindings>(
    this: ComponentPublicProperties<Props, B>,
    ctx: {
      state: B
      props: Props
    }
  ) => VNodeChild
}

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

export interface ComponentHandle {
  type: Function | ComponentOptions
  vnode: VNode | null
  next: VNode | null
  subTree: VNode | null
  update: ReactiveEffect
}

export function renderComponentRoot(handle: ComponentHandle): VNode {
  const { type, vnode } = handle
  // TODO actually resolve props
  const renderArg = {
    props: (vnode as VNode).props || EMPTY_OBJ
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
