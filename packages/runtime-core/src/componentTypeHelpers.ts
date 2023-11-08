import { ComponentOptionsBase } from './componentOptions'
import { RawOptionsSymbol } from './apiDefineComponent'
import { EmitFn, EmitsOptions, EmitsToProps } from './componentEmits'
import { ExtractPropTypes } from './componentProps'
import { Slot, Slots } from './componentSlots'
import { VNode } from '.'
import { IntersectionMixin, UnwrapMixinsType } from './componentPublicInstance'

export type ExtractComponentOptions<T> = T extends {
  [RawOptionsSymbol]: infer Options
}
  ? Options
  : T extends ComponentOptionsBase<
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any
    >
  ? T
  : T extends {
      props?: any
      emits?: any
      slots?: any
    }
  ? T
  : never

export type ExtractComponentProp<T> = T extends { props: infer P }
  ? P
  : T extends (props: infer P) => any
  ? P
  : T extends { new (): { $props: infer P } }
  ? P
  : {}

export type ExtractComponentSlots<T> = T extends ComponentOptionsBase<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  infer S
>
  ? S
  : T extends { slots: infer S }
  ? S
  : T extends { slots: infer S extends Slots }
  ? S
  : T extends (props: any, opts: { slots: infer S }) => any
  ? S
  : T extends { new (): { $slots: infer S extends Slots } }
  ? S
  : {}

export type ExtractComponentEmits<T> = T extends ComponentOptionsBase<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  infer E
>
  ? E
  : T extends {
      emits: infer E
    }
  ? E
  : T extends { emits: infer E extends EmitsOptions }
  ? E
  : T extends (props: any, opts: { emits: infer E extends EmitsOptions }) => any
  ? E
  : {}

type ResolveMixin<T> = [T] extends [
  Readonly<
    ComponentOptionsBase<
      any,
      any,
      any,
      any,
      any,
      infer M,
      infer E,
      any,
      any,
      any,
      any,
      any,
      any
    >
  >
]
  ? IntersectionMixin<M> & IntersectionMixin<E>
  : {}

type ResolveMixinProps<T> = UnwrapMixinsType<ResolveMixin<T>, 'P'>

export type ComponentProps<
  T,
  excludeEmits extends boolean = false
> = (excludeEmits extends false
  ? ExtractComponentEmits<T> extends infer E
    ? E extends EmitsOptions
      ? EmitsToProps<E>
      : unknown
    : unknown
  : {}) &
  (ExtractComponentProp<T> extends infer P
    ? P extends Readonly<Array<infer V>>
      ? [V] extends [string]
        ? Readonly<{ [key in V]?: any }>
        : {}
      : ExtractPropTypes<P>
    : {}) &
  // props to be omitted since we don't need them here
  ResolveMixinProps<Omit<T, 'props'>>

export type ComponentSlots<T> = ExtractComponentSlots<T> extends infer S
  ? {
      [K in keyof S]: S[K] extends Slot<infer V> ? (arg: V) => VNode : never
    }
  : {}

export type ComponentEmits<T> = ExtractComponentEmits<T> extends infer E
  ? {} extends E
    ? () => void
    : EmitFn<E>
  : () => void
