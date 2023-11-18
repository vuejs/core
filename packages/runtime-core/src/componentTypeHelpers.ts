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
import { VNode } from './vnode'
import { FunctionalComponent, Component } from './component'
import {
  ComponentPublicInstance,
  ComponentPublicInstanceConstructor,
  IntersectionMixin,
  UnwrapMixinsType
} from './componentPublicInstance'

/**
 * Extracts the component original options
 */
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

/*
 * Extracts the component props as the component was created,
 * or the props from the ComponentPublicInstance
 *
 * This is useful to get the props from defineComponent or options component
 */
export type ExtractComponentProp<T> = T extends { props: infer P }
  ? P
  : T extends (props: infer P) => any
  ? P
  : T extends { new (): { $props: infer P } }
  ? P
  : {}

/**
 * Extracts the component slots as the component was created
 */
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

/**
 * Extracts the component emits as the component was created
 */
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

// Helper to resolve mixins
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

/**
 * Extracts Original props from options
 */
export type ResolvePropsFromOptions<T> = T extends { props: infer P }
  ? [P] extends [Array<infer PA>]
    ? [PA] extends [string]
      ? { [key in PA]?: any }
      : never // not supported because is an array of non-string
    : P
  : T

/**
 * Get the Component props making the default optional
 * Used mainly on the render component
 */
export type ComponentPropsWithDefaultOptional<T> =
  (ResolvePropsFromOptions<T> extends infer Props
    ? ExtractDefaultPropTypes<Props> extends infer Defaults
      ? Partial<Defaults> & Omit<ExtractPropTypes<Props>, keyof Defaults>
      : {}
    : {}) &
    (T extends { props: any }
      ? ResolveMixinProps<Omit<T, 'props'>>
      : ResolveMixinProps<T>)

type ResolveMixinProps<T> = UnwrapMixinsType<ResolveMixin<T>, 'P'>

/**
 * Returns the emits as props
 */
export type ComponentEmitsProps<T> = ExtractComponentEmits<T> extends infer E
  ? E extends EmitsOptions
    ? EmitsToProps<E>
    : unknown
  : unknown

/**
 * Returns runtime props definition for a component
 *
 *  @see Include emits {@linkcode ComponentEmitsProps}
 *  @see Get the render props {@linkcode ComponentPropsWithDefaultOptional}
 *
 * @example
 * ```ts
 * import { Comp } from './Comp.vue'
 *
 * function useProps(): ComponentProps<typeof Comp> {
 *  // ...
 * }
 * ```
 */
export type ComponentProps<T> = T extends { $props: infer P }
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
        : ResolveMixinProps<T>)

/**
 * Returns runtime type for `slots`
 */
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

/**
 * Retrieves the component public instance
 *
 * @example
 * ```ts
 * const Comp = defineComponent({ props: { a: String }, emits: ['test'] })
 *
 * const instance = ref<ComponentInstance<typeof Comp>>()
 * instance.$props.a // string | undefined
 * ```
 */
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
