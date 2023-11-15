import { ComponentOptionsBase } from './componentOptions'
import { RawOptionsSymbol } from './apiDefineComponent'
import { EmitFn, EmitsOptions, EmitsToProps } from './componentEmits'
import { ExtractPropTypes } from './componentProps'
import { Slot, Slots } from './componentSlots'
import { Component, FunctionalComponent, VNode } from '.'
import {
  ComponentPublicInstance,
  ComponentPublicInstanceConstructor,
  IntersectionMixin,
  UnwrapMixinsType
} from './componentPublicInstance'

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
  : T extends { $options: infer Options }
  ? Options extends { emits: infer E }
    ? E
    : {}
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
  (T extends { $props: infer P }
    ? P
    : (ExtractComponentProp<T> extends infer P
        ? P extends Readonly<Array<infer V>>
          ? [V] extends [string]
            ? Readonly<{ [key in V]?: any }>
            : {}
          : ExtractPropTypes<P>
        : {}) &
        // props to be omitted since we don't need them here
        ResolveMixinProps<Omit<T, 'props'>>)

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

// from other PR https://github.com/vuejs/core/pull/5408
export type ComponentInstance<T> = T extends { new (): ComponentPublicInstance }
  ? InstanceType<T>
  : T extends FunctionalComponent<infer Props, infer Emits>
  ? ComponentPublicInstance<Props, {}, {}, {}, {}, Emits>
  : T extends ComponentPublicInstanceConstructor
  ? InstanceType<T>
  : T extends Component<
      infer Props,
      infer RawBindings,
      infer D,
      infer C,
      infer M
    >
  ? // NOTE we override Props/RawBindings/D to make sure is not `unknown`
    ComponentPublicInstance<
      unknown extends Props ? {} : Props,
      unknown extends RawBindings ? {} : RawBindings,
      unknown extends D ? {} : D,
      C,
      M
    >
  : never // not a vue Component

// declare function getInstance<T>(component: T): ComponentInstance<T>
// declare function getProps<T>(vm: T): ComponentProps<T>
// declare function getEmits<T>(vm: T): ExtractComponentEmits<T>

// const o = defineComponent({
//   props: {
//     a: String
//   },
//   emits: ['modelValueChange']
// })

// // const oo = new o()
// // oo.$props.$attrs.test

// const c = defineComponent({
//   props: {
//     a: String
//   },
//   // emits: ['modelValueChange']
//   emits: {
//     test: (v: string) => true
//   }
// })

// const a = getInstance(c)
// // a.bb
// // a.aa
// // a.cc
// // a.dd

// // a.$props.$attrs.tesr
// // const p = getProps(a)
// // p.$attrs.test
// // p.

// const ee = getEmits(c)
// const e = getEmits(a)
