import { extend, isFunction } from '@vue/shared'
import type { ComponentTypeEmits } from './apiSetupHelpers'
import type {
  AllowedComponentProps,
  Component,
  ComponentCustomProps,
  GlobalComponents,
  GlobalDirectives,
  SetupContext,
} from './component'
import type {
  EmitsOptions,
  EmitsToProps,
  ObjectEmitsOptions,
  ShortEmitsToObject,
  TypeEmitsToOptions,
} from './componentEmits'
import type {
  ComponentInjectOptions,
  ComponentOptions,
  ComponentOptionsBase,
  ComponentOptionsMixin,
  ComponentProvideOptions,
  ComputedOptions,
  MethodOptions,
  ObjectInjectOptions,
  RenderFunction,
} from './componentOptions'
import type {
  ComponentObjectPropsOptions,
  ComponentPropsOptions,
  ExtractDefaultPropTypes,
  ExtractPropTypes,
} from './componentProps'
import type {
  ComponentPublicInstance,
  CreateComponentPublicInstanceWithMixins,
  EnsureNonVoid,
  ExtractMixinComputed,
  ExtractMixinData,
  ExtractMixinEmits,
  ExtractMixinMethods,
  ExtractMixinProps,
  ExtractMixinSetupBindings,
} from './componentPublicInstance'
import type { SlotsType } from './componentSlots'
import type { Directive } from './directives'
import type { VNodeProps } from './vnode'

export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

type NormalizePropsOptions<T> = ComponentPropsOptions extends T ? {} : T

type NormalizeEmitsOptions<T> = EmitsOptions extends T ? {} : T

export type DefineComponent<
  OptionsOrPropsOrPropOptions = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  Mixin extends ComponentOptionsMixin = {},
  Extends extends ComponentOptionsMixin = {},
  E extends EmitsOptions = {},
  EE extends string = string,
  PP = never,
  Props = never,
  Defaults = ExtractDefaultPropTypes<OptionsOrPropsOrPropOptions>,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  MakeDefaultsOptional extends boolean = true,
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
> = {} /* use `{} &` to avoid serialization */ & (OptionsOrPropsOrPropOptions extends {
  props?: infer PropsOptions
  emits?: infer RuntimeEmitsOptions
  slots?: infer Slots
  expose?: (infer Exposed)[]
  computed?: infer Computed
  methods?: infer Methods
  mixins?: (infer Mixin)[]
  extends?: infer Extends
  setup?(props: any, ctx: any): infer SetupBindings
  data?(vm: any): infer Data
  __typeProps?: infer TypeProps
  __typeEmits?: infer TypeEmits
  __typeRefs?: infer TypeRefs
  __typeEl?: infer TypeEl extends Element
}
  ? OptionsOrPropsOrPropOptions & {
      components?: GlobalComponents
      directives?: GlobalDirectives
    } & ComponentOptionsBase<
        {},
        SetupBindings,
        Data,
        {},
        {},
        {},
        {},
        {},
        string,
        {},
        {},
        string,
        {},
        {},
        {},
        string,
        {},
        any
      > &
      InferComponentOptions<
        TypeProps,
        TypeEmits,
        TypeRefs & {},
        TypeEl,
        PropsOptions & {},
        RuntimeEmitsOptions & {},
        Data & {},
        SetupBindings,
        Computed & {},
        Methods & {},
        Mixin & {},
        Extends & {},
        Slots & {},
        Exposed & string,
        // MakeDefaultsOptional - if TypeProps is provided, set to false to use
        // user props types verbatim
        unknown extends TypeProps ? true : false,
        ExtractDefaultPropTypes<
          ExtractMixinProps<Mixin> & ExtractMixinProps<Extends> & PropsOptions
        >
      >
  : {
      props?: OptionsOrPropsOrPropOptions extends ComponentPropsOptions
        ? unknown
        : OptionsOrPropsOrPropOptions
    } & ComponentOptionsBase<
      any,
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      never,
      never,
      {},
      never,
      S,
      LC & GlobalComponents,
      Directives & GlobalDirectives,
      Exposed,
      Provide
    > &
      InferComponentOptions<
        OptionsOrPropsOrPropOptions extends ComponentPropsOptions
          ? unknown
          : OptionsOrPropsOrPropOptions,
        {},
        TypeRefs,
        TypeEl,
        OptionsOrPropsOrPropOptions extends ComponentPropsOptions
          ? NormalizePropsOptions<OptionsOrPropsOrPropOptions>
          : {},
        string extends EE ? NormalizeEmitsOptions<E> : EE[],
        D & {},
        RawBindings,
        C,
        M,
        Mixin,
        Extends,
        S,
        Exposed,
        MakeDefaultsOptional,
        Defaults
      >)

export interface InferComponentOptions<
  TypeProps,
  TypeEmits extends ComponentTypeEmits | unknown,
  TypeRefs extends Record<string, unknown>,
  TypeEl extends Element,
  PropsOptions extends ComponentPropsOptions,
  RuntimeEmitsOptions extends EmitsOptions,
  Data extends {},
  SetupBindings,
  Computed extends ComputedOptions,
  Methods extends MethodOptions,
  Mixin extends ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin,
  Slots extends SlotsType,
  Exposed extends string,
  MakeDefaultsOptional extends boolean,
  Defaults,
  // resolved types
  ResolvedEmits extends ObjectEmitsOptions = ExtractMixinEmits<Mixin> &
    ExtractMixinEmits<Extends> &
    ResolveEmitsOptions<RuntimeEmitsOptions, TypeEmits>,
  ResolvedTypeEmits = ResolveTypeEmits<RuntimeEmitsOptions, TypeEmits>,
  InferredProps = Readonly<
    ExtractPropTypes<
      ExtractMixinProps<Mixin> &
        ExtractMixinProps<Extends> &
        (unknown extends TypeProps
          ? PropsOptions extends (infer Keys extends string)[]
            ? { [K in Keys]: null }
            : PropsOptions
          : {})
    > &
      TypeProps &
      EmitsToProps<
        ResolvedEmits &
          TypeEmitsToOptions<
            string[] extends RuntimeEmitsOptions
              ? TypeEmits & {}
              : ResolvedTypeEmits & {}
          >
      >
  >,
> {
  /**
   * #3468
   *
   * type-only, used to assist Mixin's type inference,
   * typescript will try to simplify the inferred `Mixin` type,
   * with the `__differentiator`, typescript won't be able to combine different mixins,
   * because the `__differentiator` will be different
   */
  __differentiator?: keyof Data | keyof Computed | keyof Methods

  new (...args: any[]): ComponentPublicInstance<
    InferredProps,
    ExtractMixinSetupBindings<Mixin> &
      ExtractMixinSetupBindings<Extends> &
      EnsureNonVoid<SetupBindings>,
    ExtractMixinData<Mixin> & ExtractMixinData<Extends> & EnsureNonVoid<Data>,
    ExtractMixinComputed<Mixin> & ExtractMixinComputed<Extends> & Computed,
    ExtractMixinMethods<Mixin> & ExtractMixinMethods<Extends> & Methods,
    ExtractMixinEmits<Mixin> & ExtractMixinEmits<Extends> & ResolvedEmits,
    PublicProps,
    Defaults,
    MakeDefaultsOptional,
    {},
    {}, // InjectOptions
    Slots,
    Exposed,
    TypeRefs,
    TypeEl,
    ResolvedTypeEmits
  >
}

export type DefineSetupFnComponent<
  P extends Record<string, any>,
  E extends EmitsOptions = {},
  S extends SlotsType = SlotsType,
  Props = P & EmitsToProps<E>,
  PP = PublicProps,
> = new (
  props: Props & PP,
) => CreateComponentPublicInstanceWithMixins<
  Props,
  {},
  {},
  {},
  {},
  {},
  {},
  E,
  PP,
  {},
  false,
  {},
  S
>

type ResolveEmitsOptions<
  RuntimeEmitsOptions extends EmitsOptions,
  TypeEmits extends ComponentTypeEmits | unknown,
> = unknown extends TypeEmits
  ? RuntimeEmitsOptions extends ObjectEmitsOptions
    ? RuntimeEmitsOptions
    : {}
  : TypeEmits extends Record<string, any[]>
    ? ShortEmitsToObject<TypeEmits>
    : {}

type ResolveTypeEmits<
  RuntimeEmitsOptions extends EmitsOptions,
  TypeEmits extends ComponentTypeEmits | unknown,
> = TypeEmits extends (...args: any[]) => any
  ? TypeEmits
  : TypeEmits extends Record<string, any[]>
    ? {}
    : RuntimeEmitsOptions extends (infer Keys extends string)[]
      ? (event: Keys, ...args: any[]) => void
      : {}

// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
// (uses user defined props interface)
export function defineComponent<
  Props extends Record<string, any>,
  E extends EmitsOptions = string[],
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
): DefineSetupFnComponent<Props, E, S>
export function defineComponent<
  Props extends Record<string, any>,
  E extends EmitsOptions = string[],
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
  TypeProps,
  TypeEmits extends ComponentTypeEmits | unknown = unknown,
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
  RawPropsOptions extends ComponentPropsOptions = {},
  RawEmitsOptions extends EmitsOptions = string[],
  InjectOptions extends ComponentInjectOptions = {},
  Data = {},
  SetupBindings = {},
  Computed extends ComputedOptions = {},
  Methods extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = {},
  Extends extends ComponentOptionsMixin = {},
  Slots extends SlotsType = {},
  LocalComponents extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Provide extends ComponentProvideOptions = {},
  Exposed extends string = string,
  // assisted input inference
  _PropsKeys extends string = string,
  _EmitsKeys extends string = string,
  _InjectKeys extends string = string,
  // resolved types
  NormalizedProps = NormalizePropsOptions<RawPropsOptions>,
  NormalizedEmits extends EmitsOptions = NormalizeEmitsOptions<RawEmitsOptions>,
  ResolvedEmits extends ObjectEmitsOptions = ExtractMixinEmits<Mixin> &
    ExtractMixinEmits<Extends> &
    ResolveEmitsOptions<NormalizedEmits, TypeEmits>,
  ResolvedTypeEmits = ResolveTypeEmits<NormalizedEmits, TypeEmits>,
  InferredProps = Readonly<
    ExtractPropTypes<
      ExtractMixinProps<Mixin> &
        ExtractMixinProps<Extends> &
        (unknown extends TypeProps
          ? NormalizedProps extends (infer Keys extends string)[]
            ? { [K in Keys]: null }
            : NormalizedProps
          : {})
    > &
      TypeProps &
      EmitsToProps<
        ResolvedEmits &
          TypeEmitsToOptions<
            string[] extends NormalizedEmits
              ? TypeEmits & {}
              : ResolvedTypeEmits & {}
          >
      >
  >,
  InternalInstance = ComponentPublicInstance<
    InferredProps,
    ExtractMixinSetupBindings<Mixin> &
      ExtractMixinSetupBindings<Extends> &
      SetupBindings,
    ExtractMixinData<Mixin> & ExtractMixinData<Extends> & EnsureNonVoid<Data>,
    ExtractMixinComputed<Mixin> & ExtractMixinComputed<Extends> & Computed,
    ExtractMixinMethods<Mixin> & ExtractMixinMethods<Extends> & Methods,
    ResolvedEmits,
    {}, // PublicProps
    {}, // Defaults
    false,
    {},
    InjectOptions,
    Slots,
    Exposed,
    TypeRefs,
    TypeEl,
    ResolvedTypeEmits
  >,
>(
  options: {
    props?: ComponentObjectPropsOptions | RawPropsOptions | _PropsKeys[]
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
    InferredProps,
    SetupBindings,
    Data,
    Computed,
    Methods,
    Mixin,
    Extends,
    ObjectEmitsOptions | (RawEmitsOptions & ThisType<void>) | _EmitsKeys[],
    never,
    never,
    ObjectInjectOptions | InjectOptions | _InjectKeys[],
    never,
    Slots,
    Record<string, Component> | LocalComponents,
    Record<string, Directive> | Directives,
    Exposed,
    Provide,
    InternalInstance
  > &
    ThisType<
      NoInfer<InternalInstance> & {
        $options: typeof options
      }
    >,
): DefineComponent<
  {
    props?: NormalizedProps
    emits?: string[] extends NormalizedEmits ? {} : NormalizedEmits
    components?: LocalComponents
    directives?: Directives
    slots?: Slots
    expose?: Exposed[]
    computed?: Computed
    methods?: Methods
    provide?: Provide
    inject?: InjectOptions
    mixins?: Mixin[]
    extends?: Extends
    setup?(props: any, ctx: any): SetupBindings
    data?(vm: any): Data
    __typeProps?: TypeProps
    __typeEmits?: TypeEmits
    __typeRefs?: TypeRefs
    __typeEl?: TypeEl
  },
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
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

// implementation, close to no-op
/*! #__NO_SIDE_EFFECTS__ */
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
