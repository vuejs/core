import { ComponentOptionsBase } from './componentOptions'
import {
  ComponentDefineOptions,
  RawOptionsSymbol,
  defineComponent
} from './apiDefineComponent'
import { EmitFn, EmitsOptions, EmitsToProps } from './componentEmits'
import {
  ComponentPropsOptions,
  ExtractDefaultPropTypes,
  ExtractPropTypes
} from './componentProps'
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
  : T

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
export type ComponentPropsWithDefaultOptional<T> = ((
  T extends { props: infer P }
    ? [P] extends [Array<infer PA>]
      ? [PA] extends [string]
        ? { [key in PA]?: any }
        : never // not supported because is an array of non-string
      : P
    : T
) extends infer Props
  ? ExtractDefaultPropTypes<T> extends infer Defaults
    ? Partial<Defaults> & Omit<ExtractPropTypes<Props>, keyof Defaults>
    : {}
  : {}) &
  (T extends { props: any }
    ? ResolveMixinProps<Omit<T, 'props'>>
    : ResolveMixinProps<T>)

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
          : P extends ComponentPropsOptions
          ? ExtractPropTypes<P>
          : P
        : {}) &
        // props to be omitted since we don't need them here
        (T extends { props: any }
          ? ResolveMixinProps<Omit<T, 'props'>>
          : ResolveMixinProps<T>))

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
  : T extends ComponentDefineOptions<
      infer Props,
      infer RawBindings,
      infer D,
      infer C,
      infer M,
      infer Mixin,
      infer Extends,
      infer E,
      infer EE,
      infer I,
      infer II,
      infer S,
      infer Options
    >
  ? InstanceType<
      ReturnType<
        typeof defineComponent<
          //just need to treat the props a little bit
          Options extends { props: infer P }
            ? P extends Array<infer PA>
              ? PA
              : P
            : Props,
          RawBindings,
          D,
          C,
          M,
          Mixin,
          Extends,
          E,
          EE,
          I,
          II,
          S,
          Options
        >
      >
    >
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

// declare function getDefaults<T>(vm: T): ComponentPropsWithDefaultOptional<T>

// const o = defineComponent({
//   // props: {
//   //   a: Boolean,

//   //   s: String
//   // },
//   // emits: ['modelValueChange']
// })
// const ComponentWithEmits = defineComponent({
//   emits: {
//     hi: () => true
//   },
//   props: [],
//   template: ''
// })
// const aa = getDefaults(o)

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
