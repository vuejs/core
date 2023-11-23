import { ComponentOptionsBase } from './componentOptions'
import {
  DefineComponent,
  DefineComponentOptions,
  RawOptionsSymbol,
  ResolveProps,
  defineComponent
} from './apiDefineComponent'
import { EmitFn, EmitsOptions, EmitsToProps } from './componentEmits'
import {
  ComponentPropsOptions,
  ExtractDefaultPropTypes,
  ExtractPropTypes,
  PropType
} from './componentProps'
import { Slots, SlotsType, UnwrapSlotsType } from './componentSlots'
import { VNode } from './vnode'
import { FunctionalComponent, Component, SetupContext } from './component'
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
export type ExtractComponentPropOptions<T> = T extends { props: infer P }
  ? P
  : T extends (props: infer P) => any
  ? P
  : T extends { new (): { $props: infer P } }
  ? P
  : {}

/**
 * Extracts the component slots as the component was created
 */
export type ExtractComponentSlotOptions<T> = T extends ComponentOptionsBase<
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
  : T extends (props: any, opts: infer Ctx extends { slots: any }) => any
  ? Ctx['slots']
  : T extends (props: any, opts: SetupContext<unknown, infer S>) => any
  ? S
  : T extends { new (): { $slots: infer S extends Slots } }
  ? S
  : {}

/**
 * Extracts the component emits as the component was created
 */
export type ExtractComponentEmitOptions<T> = T extends ComponentOptionsBase<
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

/**
 * Helper to resolve mixins
 *
 */
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
 * Converts an Record<string, any> into a props definition like object
 * @example
 * ```ts
 * const props: ObjectToComponentProps<{ foo: 'bar' | 'baz', baz?: number }>
 *
 * // props is:
 * {
 *   foo: {
 *    type: Prop<'bar' | 'baz'>,
 *    required: true
 *   },
 *   baz: {
 *    type: Prop<number>,
 *    required: false
 *   }
 * }
 * ```
 */
export type ObjectToComponentProps<T> = T extends Record<string, any>
  ? {
      [K in keyof T]-?: {
        type: PropType<Exclude<T[K], undefined>>
        required: undefined extends T[K] ? false : true
      }
    }
  : {}

/**
 * Extracts Original props from options
 */
export type ResolvePropsFromOptions<T> = T extends { props: infer P }
  ? [P] extends [Array<infer PA>]
    ? [PA] extends [string]
      ? ObjectToComponentProps<Record<PA, any>>
      : never // not supported because is an array of non-string
    : P
  : // if functional component build props
  T extends (props: infer P, ctx?: any) => any
  ? ObjectToComponentProps<P>
  : T extends { new (): { $props: infer P } }
  ? ObjectToComponentProps<P>
  : T

/**
 * Get the Component props making the default optional
 * Used mainly on the render component
 */
export type ComponentExpectedProps<T> =
  (ResolvePropsFromOptions<T> extends infer Props
    ? ExtractDefaultPropTypes<Props> extends infer Defaults
      ? Partial<Defaults> & Omit<ExtractPropTypes<Props>, keyof Defaults>
      : {}
    : {}) &
    (T extends { props: any }
      ? ResolveMixinProps<Omit<T, 'props'>>
      : // if is functional or class no need for mixin
      T extends ((...args: any) => any) | (abstract new (...args: any) => any)
      ? {}
      : ResolveMixinProps<T>)

type FixMixinResolve<T> = [T] extends [never] ? {} : T
type ResolveMixinProps<T> = UnwrapMixinsType<ResolveMixin<T>, 'P'>
type ResolveMixinData<T> = FixMixinResolve<
  UnwrapMixinsType<ResolveMixin<T>, 'D'>
>

/**
 * Returns the emits as props
 */
export type ComponentEmitsAsProps<T> =
  ExtractComponentEmitOptions<T> extends infer E
    ? E extends EmitsOptions
      ? EmitsToProps<E>
      : unknown
    : unknown

/**
 * Returns runtime props definition for a component
 *
 *  @see Include emits {@linkcode ComponentEmitsAsProps}
 *  @see Get the render props {@linkcode ComponentExpectedProps}
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
  : (ExtractComponentPropOptions<T> extends infer P
      ? P extends Readonly<Array<infer V>>
        ? [V] extends [string]
          ? Readonly<{ [key in V]?: any }>
          : {}
        : P extends ComponentPropsOptions
        ? ExtractPropTypes<P>
        : P
      : {}) &
      // props to be omitted since we don't need them here
      ResolveMixinProps<T>

type RetrieveSlotArgument<T extends any[] = any[]> =
  | ((...args: T) => any)
  | undefined

/**
 * Returns runtime type for `slots`
 */
export type ComponentSlots<T> = ExtractComponentSlotOptions<T> extends infer S
  ? S extends SlotsType<infer SS>
    ? Record<string, any> extends SS
      ? // non slot type definition
        {
          [K in keyof S & string]: S[K] extends RetrieveSlotArgument<infer A>
            ? (...arg: A) => VNode[]
            : (arg: S[K]) => VNode[]
        }
      : // SlotType definition
        UnwrapSlotsType<S>
    : S extends Record<string, any>
    ? {
        [K in keyof S & string]: S[K] extends RetrieveSlotArgument<infer A>
          ? (...arg: A) => VNode[]
          : (arg: S[K]) => VNode[]
      }
    : {}
  : {}

/**
 * Generates the emit function type from the emits options
 */
export type ComponentEmits<T> = ExtractComponentEmitOptions<T> extends infer E
  ? {} extends E
    ? () => void
    : EmitFn<E>
  : () => void

// Helper method to extract the data from a component
type ComponentDataHelper<T> = {
  D: T extends { data: () => infer D }
    ? D
    : T extends new () => { data: () => infer D }
    ? D
    : {}
  M: ResolveMixinData<T>
  R: T extends { setup(...args: any[]): infer S }
    ? S extends Record<string, any>
      ? S
      : {}
    : {}
}

/**
 * Returns the data type for a component
 */
export type ComponentData<T> = ComponentDataHelper<T> extends {
  D: infer D
  M: infer M
  R: infer R
}
  ? Omit<M, keyof D | keyof R> & Omit<D, keyof R> & R
  : {}

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
  : T extends DefineComponentOptions<
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
  : T extends ComponentPublicInstance
  ? T
  : never // not a vue Component

/**
 * Helper to generate DefineComponent type without having to pass all the generics.
 *
 * @example
 * ```ts
 * function generateComponent<T extends Record<string, any>, S extends SlotsType>(props:T, slots: S): DeclareComponent<T, {}, {}, S>
 *
 * const Comp = generateComponent({ a: String }, { default: () => [] })
 * ```
 */
export type DeclareComponent<
  Props extends Record<string, any> | { new (): ComponentPublicInstance } = {},
  RawBindings extends Record<string, any> = {},
  Emits extends EmitsOptions = {},
  Slots extends SlotsType = {},
  Options = {}
> =
  // short-circuit to allow Generics
  Props extends { new (): infer PublicInstance extends { $props?: any } }
    ? DeclareComponent<
        PublicInstance['$props'],
        RawBindings,
        Emits,
        Slots,
        Options
      > &
        Props
    : DefineComponent<
        ObjectToComponentProps<Props>,
        RawBindings,
        {},
        {},
        {},
        {},
        {},
        Emits,
        string,
        {},
        ResolveProps<ObjectToComponentProps<Props>, Emits>,
        {},
        {},
        string,
        Slots,
        Options
      >

const Comp = defineComponent({
  props: {
    foo: String
  }
})
const props = {} as ComponentProps<typeof Comp>
props.foo // string | undefined
