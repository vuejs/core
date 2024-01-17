import type {
  ComponentInjectOptions,
  ComponentOptions,
  ComponentOptionsBase,
  ComponentOptionsMixin,
  ComputedOptions,
  MethodOptions,
  RenderFunction,
} from './componentOptions'
import type {
  AllowedComponentProps,
  ComponentCustomProps,
  SetupContext,
} from './component'
import type {
  ComponentObjectPropsOptions,
  ExtractDefaultPropTypes,
  ExtractPropTypes,
} from './componentProps'
import type { EmitsOptions, EmitsToProps } from './componentEmits'
import { extend, isFunction } from '@vue/shared'
import type { VNodeProps } from './vnode'
import type {
  ComponentPublicInstanceConstructor,
  CreateComponentPublicInstance,
} from './componentPublicInstance'
import type { SlotsType } from './componentSlots'

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
        : [Props] extends [string[]]
          ? { [key: string]: any }
          : [Props] extends [never]
            ? {}
            : [Props] extends [undefined]
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
  Mixin extends ComponentOptionsMixin = {},
  Extends extends ComponentOptionsMixin = {},
  E extends EmitsOptions = {},
  EE extends string = string,
  PP = PublicProps,
  Props = ResolveProps<PropsOrPropOptions, E>,
  Defaults = ExtractDefaultPropTypes<PropsOrPropOptions>,
  I extends ComponentInjectOptions = any,
  II extends string = string,
  S extends SlotsType = any,
  Options extends Record<PropertyKey, any> = {},
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
    'props' | 'emits'
  > &
  Omit<Options, 'emits' | 'mixins' | 'extends'> & {
    // Emits needs to be ignored and then re-added, otherwise
    // the EE (string) of the emits will be inferred along side of the Object based
    // causing the returned type to be incorrect.
    emits: Options['emits']
    // There's a test failing when extends is not re-added
    extends: Options['extends']
  } & {
    [RawOptionsSymbol]: Options
  }

type BuildComponentInstance<
  MakeDefaultsOptional extends boolean = false,
  Props = never,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = {},
  Extends extends ComponentOptionsMixin = {},
  E extends EmitsOptions = {},
  I extends ComponentInjectOptions = {},
  S extends SlotsType = {},
  Defaults extends Record<string, any> = {},
  Options = {},
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

type NamedProps<PropNames> = [PropNames] extends [string]
  ? PropNames[]
  : PropNames extends string[]
    ? PropNames
    : PropNames extends never[]
      ? PropNames
      : never
type OptionProps<Props> = [Props] extends [ComponentObjectPropsOptions]
  ? Props
  : never

export type DefineComponentOptions<
  Props = never,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = {},
  Extends extends ComponentOptionsMixin = {},
  E extends EmitsOptions = {},
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  Options extends {} = {},
  PrettyProps = Readonly<
    ExtractPropTypes<
      [Props] extends [string]
        ? { [K in Props]: any }
        : [Props] extends [string[]]
          ? { [K in string]: any }
          : [Props] extends [never]
            ? {}
            : [Props] extends [undefined]
              ? {}
              : [Props] extends [never[]]
                ? {}
                : Props
    > &
      EmitsToProps<E>
  >,
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
        'props' | 'render'
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
  | (((
      props: Props,
      ctx: SetupContext<E, S>,
    ) => RenderFunction | Promise<RenderFunction>) &
      Options)

export type DefineComponentFromOptions<
  Props = never,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = {},
  Extends extends ComponentOptionsMixin = {},
  E extends EmitsOptions = {},
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  Options extends Record<PropertyKey, any> = {},
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
  S extends SlotsType = {},
>(
  setup: (
    props: Props,
    ctx: SetupContext<E, S>,
  ) => RenderFunction | Promise<RenderFunction>,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs'> & {
    props?: (keyof Props)[]
    emits?: E | EE[]
    slots?: S
  },
): (props: Props & EmitsToProps<E>) => any
export function defineComponent<
  Props extends Record<string, any>,
  E extends EmitsOptions = {},
  EE extends string = string,
  S extends SlotsType = {},
>(
  setup: (
    props: Props,
    ctx: SetupContext<E, S>,
  ) => RenderFunction | Promise<RenderFunction>,
  options?: Pick<ComponentOptions, 'name' | 'inheritAttrs'> & {
    props?: ComponentObjectPropsOptions<Props>
    emits?: E | EE[]
    slots?: S
  },
): (props: Props & EmitsToProps<E>) => any

// overload 3: DefineComponentOptions
export function defineComponent<
  Props = undefined,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = {},
  Extends extends ComponentOptionsMixin = {},
  E extends EmitsOptions = {},
  EE extends string = string,
  I extends ComponentInjectOptions = {},
  II extends string = string,
  S extends SlotsType = {},
  Options extends Record<PropertyKey, any> = {},
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
  >,
): DefineComponentFromOptions<
  undefined extends Props ? {} : Props,
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
