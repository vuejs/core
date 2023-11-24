import {
  ComputedOptions,
  MethodOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps,
  ComponentOptionsMixin,
  RenderFunction,
  ComponentInjectOptions,
  ComponentOptions,
  ComponentOptionsBase
} from './componentOptions'
import {
  SetupContext,
  AllowedComponentProps,
  ComponentCustomProps
} from './component'
import {
  ComponentObjectPropsOptions,
  ExtractPropTypes,
  ExtractDefaultPropTypes
} from './componentProps'
import { EmitsOptions, EmitsToProps } from './componentEmits'
import { extend, isFunction } from '@vue/shared'
import { VNodeProps } from './vnode'
import {
  CreateComponentPublicInstance,
  ComponentPublicInstanceConstructor
} from './componentPublicInstance'
import { SlotsType } from './componentSlots'

export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

export type ResolveProps<Props, E extends EmitsOptions> = Readonly<
  ([Props] extends [string]
    ? { [key in Props]?: any }
    : [Props] extends [ComponentObjectPropsOptions]
      ? ExtractPropTypes<Props>
      : Props extends never[]
        ? {}
        : Props) &
    ({} extends E ? {} : EmitsToProps<E>)
>

export declare const RawOptionsSymbol: '__rawOptions'

export type DefineComponent<
  PropsOrPropOptions = any,
  RawBindings = any,
  D = any,
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  PP = PublicProps,
  Props = ResolveProps<PropsOrPropOptions, E>,
  Defaults = ExtractDefaultPropTypes<PropsOrPropOptions>,
  I extends ComponentInjectOptions = any,
  II extends string = string,
  S extends SlotsType = any,
  Options = {}
> = ComponentPublicInstanceConstructor<
  CreateComponentPublicInstance<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    PP & Props,
    Defaults,
    true,
    I,
    S,
    Options
  >
> &
  Omit<
    ComponentOptionsBase<
      Props,
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      EE,
      Defaults,
      I,
      II,
      S
    >,
    'props'
  > & { props: PropsOrPropOptions } & Omit<Options, 'props'> & {
    [RawOptionsSymbol]: Options
  } & PP

type BuildComponentInstance<
  MakeDefaultsOptional extends boolean = false,
  Props = never,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  I extends ComponentInjectOptions = {},
  S extends SlotsType = {},
  Defaults extends Record<string, any> = {},
  Options = {}
> = CreateComponentPublicInstance<
  Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  Props,
  Defaults,
  MakeDefaultsOptional,
  I,
  S,
  Options
>

type NamedProps<PropNames> = [PropNames] extends [string] ? PropNames[] : never
type OptionProps<Props> = [Props] extends [ComponentObjectPropsOptions]
  ? Props
  : never

// export type Test<Props = never> = {
//   props: NamedProps<Props> | OptionProps<Props>
//   test(a: Props): void
// }

// declare function test<Props = never>(options: Test<Props>): void

// test({
//   props: ['a', 'b'],
//   test(a) {
//     // @ts-expect-error
//     a = 'asd'
//   }
// })
// test({
//   props: { a: String },
//   test(a) {
//     a.
//   }
// })

export type DefineComponentOptions<
  Props = never,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  Options = {},
  PrettyProps = Readonly<
    ExtractPropTypes<
      [Props] extends [string]
        ? { [K in Props]: any }
        : [Props] extends [never]
          ? {}
          : [Props] extends [undefined]
            ? {}
            : Props
    > &
      EmitsToProps<E>
  >
> =
  | (Options & {
      props?: NamedProps<Props> | OptionProps<Props> | undefined
    } & Omit<
        ComponentOptionsBase<
          PrettyProps,
          RawBindings,
          D,
          C,
          M,
          Mixin,
          Extends,
          E,
          EE,
          {},
          I,
          II,
          S
        >,
        'props'
      > &
      ThisType<
        BuildComponentInstance<
          false,
          PrettyProps,
          RawBindings,
          D,
          C,
          M,
          Mixin,
          Extends,
          E,
          I,
          S,
          ExtractPropTypes<Props>,
          Options
        >
      >)
  // ([Props] extends [string]
  //   ? {} /*ComponentOptionsWithArrayProps<
  //       Props,
  //       RawBindings,
  //       D,
  //       C,
  //       M,
  //       Mixin,
  //       Extends,
  //       E,
  //       EE,
  //       I,
  //       II,
  //       S
  //     >*/
  //   : [Props] extends [undefined]
  //   ? {
  //       // props?: undefined
  //     }
  //   : // {
  //   //     props?: undefined
  //   //   } & ComponentOptionsWithoutProps<
  //   //     {},
  //   //     RawBindings,
  //   //     D,
  //   //     C,
  //   //     M,
  //   //     Mixin,
  //   //     Extends,
  //   //     E,
  //   //     EE,
  //   //     I,
  //   //     II,
  //   //     S
  //   //   >
  //   Props extends ComponentObjectPropsOptions
  //   ? {}
  //   : // ComponentOptionsWithObjectProps<
  //     //     Props,
  //     //     RawBindings,
  //     //     D,
  //     //     C,
  //     //     M,
  //     //     Mixin,
  //     //     Extends,
  //     //     E,
  //     //     EE,
  //     //     I,
  //     //     II,
  //     //     S
  //     //   >
  //     // adding support for ComponentOProp
  //     ComponentOptions<
  //       Readonly<Record<string, any> & EmitsToProps<E>>,
  //       RawBindings,
  //       D,
  //       C,
  //       M,
  //       Mixin,
  //       Extends,
  //       E,
  //       I,
  //       S
  //     >)
  | (((
      props: Props,
      ctx: SetupContext<E, S>
    ) => RenderFunction | Promise<RenderFunction>) &
      Options)

export type DefineComponentFromOptions<
  Props = never,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  Options = {}
> = DefineComponent<
  [Props] extends [string]
    ? Props[]
    : undefined extends Props
      ? {}
      : Props extends never[]
        ? string[]
        : Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  PublicProps,
  ResolveProps<Props, E>,
  ExtractDefaultPropTypes<Props>,
  I,
  II,
  S,
  Options
>

// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
export function defineComponent<
  Props extends Record<string, any>,
  E extends EmitsOptions = {},
  EE extends string = string,
  S extends SlotsType = {}
>(
  setup: (
    props: Props,
    ctx: SetupContext<E, S>
  ) => RenderFunction | Promise<RenderFunction>,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs'> & {
    props?: (keyof Props)[]
    emits?: E | EE[]
    slots?: S
  }
): (props: Props & EmitsToProps<E>) => any
export function defineComponent<
  Props extends Record<string, any>,
  E extends EmitsOptions = {},
  EE extends string = string,
  S extends SlotsType = {}
>(
  setup: (
    props: Props,
    ctx: SetupContext<E, S>
  ) => RenderFunction | Promise<RenderFunction>,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs'> & {
    props?: ComponentObjectPropsOptions<Props>
    emits?: E | EE[]
    slots?: S
  }
): (props: Props & EmitsToProps<E>) => any

// // overload 2: object format with no props
// // (uses user defined props interface)
// // return type is for Vetur and TSX support
// export function defineComponent<
//   Props = {},
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
//   options: Options &
//     ComponentOptionsWithoutProps<
//       Props,
//       RawBindings,
//       D,
//       C,
//       M,
//       Mixin,
//       Extends,
//       E,
//       EE,
//       I,
//       II,
//       S
//     >
// ): DefineComponent<
//   Props,
//   RawBindings,
//   D,
//   C,
//   M,
//   Mixin,
//   Extends,
//   E,
//   EE,
//   PublicProps,
//   ResolveProps<Props, E>,
//   ExtractDefaultPropTypes<Props>,
//   I,
//   II,
//   S,
//   Options
// >

// overload 3: DefineComponentOptions
export function defineComponent<
  Props = undefined,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  Options = {}
>(
  options: DefineComponentOptions<
    Props,
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
): DefineComponentFromOptions<
  Props,
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

// // Overload 4: {props: ComponentPropsOptions}
// export function defineComponent<
//   Props = {},
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
//   PrettyProps = {}
// >(
//   options: Options &
//     ComponentOptionsWithObjectProps<
//       Props,
//       RawBindings,
//       D,
//       C,
//       M,
//       Mixin,
//       Extends,
//       E,
//       EE,
//       I,
//       II,
//       S,
//       PrettyProps
//     >
// ): DefineComponent<
//   Props,
//   RawBindings,
//   D,
//   C,
//   M,
//   Mixin,
//   Extends,
//   E,
//   EE,
//   PublicProps,
//   ResolveProps<Props, E>,
//   ExtractDefaultPropTypes<Props>,
//   I,
//   II,
//   S,
//   Options
// >

// implementation, close to no-op
/*! #__NO_SIDE_EFFECTS__ */
export function defineComponent(options: unknown, extraOptions?: unknown) {
  return isFunction(options)
    ? // #8326: extend call and options.name access are considered side-effects
      // by Rollup, so we have to wrap it in a pure-annotated IIFE.
      /*#__PURE__*/ (() =>
        extend({ name: options.name }, extraOptions, { setup: options }))()
    : options
}

const a = defineComponent({
  props: ['a', 'b'],

  mounted() {
    this.$emit('test')
  },

  setup(props) {
    props.a
    props.b
    // @ts-expect-error
    props.c
  }
})

const b = defineComponent({
  mounted() {
    this.$emit('test')
  },
  setup(props, ctx) {}
})

const c = defineComponent({
  props: { a: String },

  mounted() {
    this.$emit('test')
  },

  setup(props) {
    props.a
    // @ts-expect-error
    props.b
  }
})
