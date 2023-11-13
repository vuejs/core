import {
  ComponentInjectOptions,
  ComponentOptionsBase,
  ComponentOptionsMixin,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps,
  ComponentOptionsWithoutProps,
  ComputedOptions,
  MethodOptions,
  RenderFunction
} from './componentOptions'
import { RawOptionsSymbol } from './apiDefineComponent'
import { EmitFn, EmitsOptions, EmitsToProps } from './componentEmits'
import {
  ComponentObjectPropsOptions,
  ComponentPropsOptions,
  ExtractPropTypes,
  Prop,
  PropType
} from './componentProps'
import { Slot, Slots, SlotsType } from './componentSlots'
import { SetupContext, VNode, h } from '.'
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

// export type ComponentDefineOptions<
//   // OriginalProps = never,
//   Props = never,
//   RawBindings = {},
//   D = {},
//   C extends ComputedOptions = {},
//   M extends MethodOptions = {},
//   Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
//   Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
//   E extends EmitsOptions = {},
//   EE extends string = string,
//   I extends ComponentInjectOptions = {},
//   II extends string = string,
//   S extends SlotsType = {},
//   Options = {},
//   // test stuff
//   // PropNames extends string = Props extends string ? Props : never,
//   PropOptions extends ComponentObjectPropsOptions<
//     Record<keyof Props, any>
//   > = ComponentObjectPropsOptions<Record<keyof Props, any>>
// > =
//   | (Options & {
//       props?: [Props] extends [string] ? Props[] : PropOptions
//       // [K: string] :any
//     } & (Props extends string
//         ? ComponentOptionsWithArrayProps<
//             Props,
//             RawBindings,
//             D,
//             C,
//             M,
//             Mixin,
//             Extends,
//             E,
//             EE,
//             I,
//             II,
//             S
//           >
//         : [Props] extends [undefined]
//         ? ComponentOptionsWithoutProps<
//             {},
//             RawBindings,
//             D,
//             C,
//             M,
//             Mixin,
//             Extends,
//             E,
//             EE,
//             I,
//             II,
//             S
//           >
//         : [Props] extends [ComponentObjectPropsOptions]
//         ? ComponentOptionsWithObjectProps<
//             Props,
//             RawBindings,
//             D,
//             C,
//             M,
//             Mixin,
//             Extends,
//             E,
//             EE,
//             I,
//             II,
//             S
//           >
//         : never))
//   | (((
//       props: Props,
//       ctx: SetupContext<E, S>
//     ) => RenderFunction | Promise<RenderFunction>) &
//       Options)

// declare function supa<
//   Props = undefined,
//   RawBindings = {},
//   D = {},
//   C extends ComputedOptions = {},
//   M extends MethodOptions = {},
//   Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
//   Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
//   E extends EmitsOptions = {},
//   EE extends string = string,
//   I extends ComponentInjectOptions = {},
//   II extends string = string,
//   S extends SlotsType = {},
//   Options = {}
// >(
//   options: ComponentDefineOptions<
//     Props,
//     RawBindings,
//     D,
//     C,
//     M,
//     Mixin,
//     Extends,
//     E,
//     EE,
//     I,
//     II,
//     S,
//     Options
//   >
// ): Options

// const a = supa({
//   NonExistentOption: 'assa',
//   setup(props) {}
// })

// const e = supa({})

// const b = supa({
//   props: ['a'],
//   setup(props) {
//     props.a
//     //@ts-expect-error
//     props.b
//   }
// })

// const c = supa({
//   props: {
//     a: String,
//     b: {
//       type: String,
//       required: true
//     }
//   },
//   setup(props) {
//     props.a
//     props.b
//     //@ts-expect-error
//     props.c
//   }
// })

// const f = supa(() => () => '')
// const aa = supa({
//   // props: undefined,
//   // props: undefined as never,
//   setup(props) {
//     return () => h('div')
//   }
// })

// const v = supa({
//   props: {
//     a: String,
//     aa: null,
//     b: {
//       type: String,
//       required: true,
//       validator: (b: unknown) => {
//         // this.
//         return true
//       }
//     },
//     c: {
//       type: Boolean
//       // validator(b: unknown) {
//       //   return false
//       // }
//     }
//     // d: {
//     //   type: String,
//     //   validator(b: unknown): boolean {
//     //     return false
//     //   },
//     //   required: true
//     // }
//   },
//   setup(props) {
//     props.b, props.c
//   },
//   ssss(p, c) {
//     c
//   }
// })

// const pp = ComponentObjectProps({
//   props: {
//     a: String,
//     b: {
//       type: String,
//       validator(b) {
//         return true
//       }
//     }
//   }
// })

// declare function propValidation<T>(options: ComponentObjectPropsOptions<T>): T

// propValidation({
//   a: String,
//   b: {
//     type: String,
//     validator(b) {
//       return true
//     }
//   }
// })

// declare function ComponentObjectProps<T extends ComponentObjectPropsOptions>(
//   options: ComponentOptionsWithObjectProps<T>
// ): T
