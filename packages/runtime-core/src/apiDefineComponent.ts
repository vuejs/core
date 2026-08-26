import type {
  ComponentInjectOptions,
  ComponentOptions,
  ComponentOptionsBase,
  ComponentOptionsMixin,
  ComponentProvideOptions,
  ComputedOptions,
  MethodOptions,
  RenderFunction,
} from './componentOptions'
import type {
  AllowedComponentProps,
  Component,
  ComponentCustomProps,
  GlobalComponents,
  GlobalDirectives,
  SetupContext,
} from './component'
import type {
  ComponentObjectPropsOptions,
  ComponentPropsOptions,
  ExtractDefaultPropTypes,
  ExtractPropTypes,
  ExtractPublicPropTypes,
  Prop,
} from './componentProps'
import type {
  EmitsOptions,
  EmitsToProps,
  TypeEmitsToOptions,
} from './componentEmits'
import {
  type IsKeyValues,
  type LooseRequired,
  extend,
  isFunction,
} from '@vue/shared'
import type { VNodeProps } from './vnode'
import type {
  ComponentPublicInstanceConstructor,
  CreateComponentPublicInstanceWithMixins,
} from './componentPublicInstance'
import type { SlotsType } from './componentSlots'
import type { Directive } from './directives'
import type { ComponentTypeEmits } from './apiSetupHelpers'

export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

type ResolveProps<PropsOrPropOptions, E extends EmitsOptions> = Readonly<
  PropsOrPropOptions extends ComponentPropsOptions
    ? ExtractPropTypes<PropsOrPropOptions>
    : PropsOrPropOptions
> &
  ({} extends E ? {} : EmitsToProps<E>)

export type DefineComponent<
  PropsOrPropOptions = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  PP = PublicProps,
  Props = ResolveProps<PropsOrPropOptions, E>,
  Defaults = ExtractDefaultPropTypes<PropsOrPropOptions>,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  MakeDefaultsOptional extends boolean = true,
  TypeRefs extends Record<string, unknown> = {},
  TypeEl = any,
> = ComponentPublicInstanceConstructor<
  CreateComponentPublicInstanceWithMixins<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    PP,
    Defaults,
    MakeDefaultsOptional,
    {},
    S,
    LC & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed,
    TypeRefs,
    TypeEl
  >
> &
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
    {},
    string,
    S,
    LC & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed,
    Provide
  > &
  PP

export type DefineSetupFnComponent<
  P extends Record<string, any>,
  E extends EmitsOptions = {},
  S extends SlotsType = SlotsType,
  Props = P & EmitsToProps<E>,
  PP = PublicProps,
  InstanceProps = Props,
> = new (props: Props & PP) => Omit<
  CreateComponentPublicInstanceWithMixins<
    InstanceProps,
    {},
    {},
    {},
    {},
    ComponentOptionsMixin,
    ComponentOptionsMixin,
    E,
    PP,
    {},
    false,
    {},
    S
  >,
  '$props'
> & {
  $props: Props & PP
}

type ToResolvedProps<Props, Emits extends EmitsOptions> = Readonly<Props> &
  Readonly<EmitsToProps<Emits>>

// ComponentObjectPropsOptions<P> widens values to `Prop<P[K]> | null`.
// Detect that mapped form so we don't run Extract* on it again.
type PropValueType<V> = [Exclude<V, undefined>] extends [Prop<infer T> | null]
  ? [Prop<T> | null] extends [Exclude<V, undefined>]
    ? T
    : never
  : never

type PreTypedKeys<O> = {
  [K in keyof O]-?: [PropValueType<O[K]>] extends [never] ? never : K
}[keyof O]

type LiteralRuntimePropKeys<O> = Exclude<keyof O, PreTypedKeys<O>>

type PreTypedProps<O> = {
  [K in keyof Pick<O, PreTypedKeys<O>>]: PropValueType<O[K]>
}

type LiteralRuntimePropsOptions<O> = {
  [K in keyof Pick<O, LiteralRuntimePropKeys<O>>]: O[K]
}

type PublicRuntimeProps<O extends ComponentObjectPropsOptions> =
  PreTypedProps<O> & ExtractPublicPropTypes<LiteralRuntimePropsOptions<O>>

type ResolvedRuntimeProps<O extends ComponentObjectPropsOptions> = Readonly<
  LooseRequired<
    Readonly<PreTypedProps<O> & ExtractPropTypes<LiteralRuntimePropsOptions<O>>>
  >
>

type IsEqual<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false

// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
// (uses user defined props interface)
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
    props?: (keyof NoInfer<Props>)[]
    emits?: E | EE[]
    slots?: S
  },
): DefineSetupFnComponent<Props, E, S>
// function syntax + object runtime props, unannotated setup:
// setup gets resolved/internal props; public contract stays ExtractPublicPropTypes (#13964).
// An explicit annotation that is exactly the resolved setup type cannot be
// distinguished from unannotated inference, so it also uses the public contract.
export function defineComponent<
  RuntimePropsOptions extends ComponentObjectPropsOptions,
  E extends EmitsOptions = {},
  EE extends string = string,
  S extends SlotsType = {},
  P = ResolvedRuntimeProps<RuntimePropsOptions>,
>(
  setup: IsEqual<P, ResolvedRuntimeProps<RuntimePropsOptions>> extends true
    ? (
        props: P,
        ctx: SetupContext<E, S>,
      ) => RenderFunction | Promise<RenderFunction>
    : never,
  options: Pick<ComponentOptions, 'name' | 'inheritAttrs'> & {
    props: RuntimePropsOptions
    emits?: E | EE[]
    slots?: S
  },
): DefineSetupFnComponent<
  PublicRuntimeProps<RuntimePropsOptions>,
  E,
  S,
  PublicRuntimeProps<RuntimePropsOptions> & EmitsToProps<E>,
  PublicProps,
  ToResolvedProps<ResolvedRuntimeProps<RuntimePropsOptions>, E>
>
// function syntax + object runtime props, annotated setup
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
): DefineSetupFnComponent<Props, E, S>

// overload 2: defineComponent with options object, infer props from options
export function defineComponent<
  // props
  TypeProps,
  RuntimePropsOptions extends ComponentObjectPropsOptions =
    ComponentObjectPropsOptions,
  RuntimePropsKeys extends string = string,
  // emits
  TypeEmits extends ComponentTypeEmits = {},
  RuntimeEmitsOptions extends EmitsOptions = {},
  RuntimeEmitsKeys extends string = string,
  // other options
  Data = {},
  SetupBindings = {},
  Computed extends ComputedOptions = {},
  Methods extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  InjectOptions extends ComponentInjectOptions = {},
  InjectKeys extends string = string,
  Slots extends SlotsType = {},
  LocalComponents extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  // resolved types
  ResolvedEmits extends EmitsOptions = {} extends RuntimeEmitsOptions
    ? TypeEmitsToOptions<TypeEmits>
    : RuntimeEmitsOptions,
  InferredProps = IsKeyValues<TypeProps> extends true
    ? TypeProps
    : string extends RuntimePropsKeys
      ? ComponentObjectPropsOptions extends RuntimePropsOptions
        ? {}
        : ExtractPropTypes<RuntimePropsOptions>
      : { [key in RuntimePropsKeys]?: any },
  TypeRefs extends Record<string, unknown> = {},
  TypeEl = any,
>(
  options: {
    props?: (RuntimePropsOptions & ThisType<void>) | RuntimePropsKeys[]
    /**
     * @private for language-tools use only
     */
    __typeProps?: TypeProps
    /**
     * @private for language-tools use only
     */
    __typeEmits?: TypeEmits
    /**
     * @private for language-tools use only
     */
    __typeRefs?: TypeRefs
    /**
     * @private for language-tools use only
     */
    __typeEl?: TypeEl
  } & ComponentOptionsBase<
    ToResolvedProps<InferredProps, ResolvedEmits>,
    SetupBindings,
    Data,
    Computed,
    Methods,
    Mixin,
    Extends,
    RuntimeEmitsOptions,
    RuntimeEmitsKeys,
    {}, // Defaults
    InjectOptions,
    InjectKeys,
    Slots,
    LocalComponents,
    Directives,
    Exposed,
    Provide
  > &
    ThisType<
      CreateComponentPublicInstanceWithMixins<
        ToResolvedProps<InferredProps, ResolvedEmits>,
        SetupBindings,
        Data,
        Computed,
        Methods,
        Mixin,
        Extends,
        ResolvedEmits,
        {},
        {},
        false,
        InjectOptions,
        Slots,
        LocalComponents,
        Directives,
        string
      >
    >,
): DefineComponent<
  InferredProps,
  SetupBindings,
  Data,
  Computed,
  Methods,
  Mixin,
  Extends,
  ResolvedEmits,
  RuntimeEmitsKeys,
  PublicProps,
  ToResolvedProps<InferredProps, ResolvedEmits>,
  ExtractDefaultPropTypes<RuntimePropsOptions>,
  Slots,
  LocalComponents,
  Directives,
  Exposed,
  Provide,
  // MakeDefaultsOptional - if TypeProps is provided, set to false to use
  // user props types verbatim
  unknown extends TypeProps ? true : false,
  TypeRefs,
  TypeEl
>

// implementation, close to no-op
/*@__NO_SIDE_EFFECTS__*/
export function defineComponent(
  options: unknown,
  extraOptions?: ComponentOptions,
) {
  return isFunction(options)
    ? // #8236: extend call and options.name access are considered side-effects
      // by Rollup, so we have to wrap it in a pure-annotated IIFE.
      /*@__PURE__*/ (() =>
        extend({ name: options.name }, extraOptions, { setup: options }))()
    : options
}
