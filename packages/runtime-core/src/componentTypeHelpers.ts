import { ComponentOptionsBase, ComponentOptionsMixin } from './componentOptions'
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

export type ExtractComponentSlots<T> = T extends {
  [RawOptionsSymbol]: infer Options
}
  ? Options
  : T extends { slots: infer S extends Slots }
  ? S
  : T extends (props: any, opts: { slots: infer S extends Slots }) => any
  ? S
  : T extends { new (): { $slots: infer S extends Slots } }
  ? S
  : {}

export type ExtractComponentEmits<T> = T extends {
  [RawOptionsSymbol]: infer Options extends ComponentOptionsMixin
}
  ? Options['emits']
  : T extends { emits: infer E extends EmitsOptions }
  ? E
  : T extends (props: any, opts: { emits: infer E extends EmitsOptions }) => any
  ? E
  : // : T extends { new (): { $emits: infer E extends EmitsOptions } }
    // ? S
    {}

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
  ? ExtractComponentEmits<T> extends infer E extends EmitsOptions
    ? {} extends E
      ? unknown
      : EmitsToProps<E>
    : unknown
  : unknown) &
  (ExtractComponentProp<T> extends infer P
    ? P extends Readonly<Array<infer V>>
      ? [V] extends [string]
        ? Readonly<{ [key in V]?: any }>
        : {}
      : ExtractPropTypes<P>
    : {}) &
  // props to be omitted since it does not like of `readonly ['', '']` props
  ResolveMixinProps<Omit<T, 'props'>>

export type ComponentSlots<T> = ExtractComponentSlots<T> extends infer S extends
  Slots
  ? {
      [K in keyof S]: S[K] extends Slot<infer V> ? (arg: V) => VNode : never
    }
  : {}

// export type ComponentEmits<T> = ExtractComponentOptions<T> extends {
//   emits: infer E
// }
//   ? E extends EmitsOptions
//     ? EmitsToProps<E>
//     : {}
//   : T extends (props: any, opts: { emits: infer E extends EmitsOptions }) => any
//   ? EmitsToProps<E>
//   : {}

export type ComponentEmits<T> = ExtractComponentEmits<T> extends infer E
  ? {} extends E
    ? () => void
    : EmitFn<E>
  : () => void

export type ComponentInternalInstance = {}
export type ComponentInstance = {}

// type P = ComponentProps<{
//   props: readonly ['a']
//   emits: ['a']
// }>

// type AA = ComponentEmits<{
//   emits: {
//     a: (a: string) => true
//   }
// }>
// type AA1 = ComponentEmits<
//   (props: {}, ctx: { emits: { a: (a: string) => true } }) => void
// >

// type BB1 = ExtractComponentEmits<{}>
// type B1 = ComponentEmits<{}>
