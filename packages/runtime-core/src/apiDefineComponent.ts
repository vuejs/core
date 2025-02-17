import { extend, isFunction, LooseRequired } from '@vue/shared'
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
  EmitsToProps,
  ObjectEmitsOptions,
  TypeEmitsToOptions,
} from './componentEmits'
import type {
  ComponentOptions,
  ComponentOptionsBase,
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
  ComponentPublicInstanceConstructor,
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

type ResolveProps<PropsOrPropOptions, E extends ObjectEmitsOptions> = Readonly<
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
  Mixin = {},
  Extends = {},
  E extends ObjectEmitsOptions = {},
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
  TypeEl extends Element = any,
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
> & {
  computed?: C
  methods?: M
  mixins?: Mixin[]
  extends?: Extends
  inject?: {}
  slots?: S
  components?: LC & GlobalComponents
  directives?: Directives & GlobalDirectives
  expose?: Exposed[]
  provide?: Provide
  setup?: () => RawBindings
  data?: () => D

  // allow any custom options
  [key: string]: any
} & Omit<
    ComponentOptionsBase,
    | 'computed'
    | 'methods'
    | 'mixins'
    | 'extends'
    | 'inject'
    | 'slots'
    | 'components'
    | 'directives'
    | 'expose'
    | 'provide'
    | 'setup'
    | 'data'
  > &
  PP

export type DefineSetupFnComponent<
  P extends Record<string, any>,
  E extends ObjectEmitsOptions = {},
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

// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
// (uses user defined props interface)
export function defineComponent<
  Props extends Record<string, any>,
  E extends ObjectEmitsOptions = {},
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
  E extends ObjectEmitsOptions = {},
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
  // input inference
  TypeProps,
  TypeEmits extends ComponentTypeEmits | unknown = unknown,
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
  RuntimePropsKeys extends string = string,
  RuntimeEmitsKeys extends string = string,
  InjectKeys extends string = string,
  Exposed extends string = string,
  RuntimePropsOptions extends
    ComponentObjectPropsOptions = ComponentObjectPropsOptions,
  RuntimeEmitsOptions extends ObjectEmitsOptions = ObjectEmitsOptions,
  InjectOptions extends ObjectInjectOptions = {},
  Data = {},
  SetupBindings = {},
  Computed extends ComputedOptions = {},
  Methods extends MethodOptions = {},
  Mixin = {},
  Extends = {},
  Slots extends SlotsType = {},
  LocalComponents extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Provide extends ComponentProvideOptions = {},
  // normalized types
  NormalizedPropsOptions = unknown extends TypeProps
    ? string extends RuntimePropsKeys
      ? ComponentObjectPropsOptions extends RuntimePropsOptions
        ? {}
        : RuntimePropsOptions
      : { [K in RuntimePropsKeys]: null }
    : {},
  NormalizedEmitsOptions extends ObjectEmitsOptions = unknown extends TypeEmits
    ? string extends RuntimeEmitsKeys
      ? RuntimeEmitsOptions
      : { [K in RuntimeEmitsKeys]: (...args: any) => any }
    : {},
  NormalizedInjectOptions extends
    ObjectInjectOptions = string extends InjectKeys
    ? InjectOptions
    : { [K in InjectKeys]: any },
  // mixin inference
  MixinProps = ExtractMixinProps<Mixin> & ExtractMixinProps<Extends>,
  MixinEmits = ExtractMixinEmits<Mixin> & ExtractMixinEmits<Extends>,
  MixinBindings = ExtractMixinSetupBindings<Mixin> &
    ExtractMixinSetupBindings<Extends>,
  MixinData = ExtractMixinData<Mixin> & ExtractMixinData<Extends>,
  MixinComputeds extends ComputedOptions = ExtractMixinComputed<Mixin> &
    ExtractMixinComputed<Extends> & {},
  MixinMethods = ExtractMixinMethods<Mixin> & ExtractMixinMethods<Extends>,
  MixinDefaults = {}, // TODO
  // merged types
  CompleteProps = MixinProps & NormalizedPropsOptions,
  CompleteBindings = MixinBindings & SetupBindings,
  CompleteData = MixinData & EnsureNonVoid<Data>,
  CompleteComputed extends ComputedOptions = MixinComputeds & Computed,
  CompleteMethods extends MethodOptions = MixinMethods & Methods,
  CompleteEmits_Internal extends ObjectEmitsOptions = MixinEmits &
    NormalizedEmitsOptions,
  CompleteEmits_Public extends ObjectEmitsOptions = MixinEmits &
    (ObjectEmitsOptions extends NormalizedEmitsOptions
      ? {}
      : NormalizedEmitsOptions),
  // resolved types
  EmitsOptionsByType = TypeEmitsToOptions<TypeEmits & {}>,
  ResolvedEmitsOptions_Internal extends
    ObjectEmitsOptions = CompleteEmits_Internal & EmitsOptionsByType,
  ResolvedEmitsOptions_Public extends
    ObjectEmitsOptions = CompleteEmits_Public & EmitsOptionsByType,
  InferredProps = ExtractPropTypes<CompleteProps> & TypeProps,
  InferredProps_Internal = Readonly<
    InferredProps &
      EmitsToProps<CompleteEmits_Internal & ResolvedEmitsOptions_Internal>
  >,
  InferredProps_Public = Readonly<
    InferredProps &
      EmitsToProps<CompleteEmits_Public & ResolvedEmitsOptions_Public>
  >,
  // instance types
  DataInstance = ComponentPublicInstance<
    InferredProps_Internal,
    CompleteBindings,
    MixinData,
    MixinComputeds,
    CompleteMethods,
    ResolvedEmitsOptions_Internal
  >,
  OptionsInstance = ComponentPublicInstance<
    InferredProps_Internal,
    CompleteBindings,
    CompleteData,
    CompleteComputed,
    CompleteMethods,
    ResolvedEmitsOptions_Internal,
    {}, // PublicProps
    {}, // Defaults
    false,
    NormalizedInjectOptions,
    Slots,
    Exposed,
    TypeRefs,
    TypeEl
  >,
  ReturnInstance = ComponentPublicInstance<
    InferredProps_Public,
    CompleteBindings,
    CompleteData,
    CompleteComputed,
    CompleteMethods,
    CompleteEmits_Public,
    PublicProps,
    ExtractDefaultPropTypes<NormalizedPropsOptions>,
    // MakeDefaultsOptional - if TypeProps is provided, set to false to use
    // user props types verbatim
    unknown extends TypeProps ? true : false,
    {}, // InjectOptions
    Slots,
    Exposed,
    TypeRefs,
    TypeEl
  >,
>(
  options: {
    props?: (RuntimePropsOptions & ThisType<void>) | RuntimePropsKeys[]
    emits?: (RuntimeEmitsOptions & ThisType<void>) | RuntimeEmitsKeys[]
    components?: LocalComponents
    directives?: Directives
    slots?: Slots
    expose?: Exposed[]
    computed?: Computed
    methods?: Methods
    provide?: Provide
    inject?: InjectOptions | InjectKeys[]
    mixins?: Mixin[]
    extends?: Extends
    setup?: (
      this: void,
      props: LooseRequired<InferredProps_Internal>,
      ctx: SetupContext<NormalizedEmitsOptions, Slots>,
    ) => Promise<SetupBindings> | SetupBindings | RenderFunction | void
    data?: (this: DataInstance, vm: DataInstance) => Data
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

    // allow any custom options
    [key: string]: any
  } & Omit<
    ComponentOptionsBase,
    | 'props'
    | 'emits'
    | 'components'
    | 'directives'
    | 'slots'
    | 'expose'
    | 'computed'
    | 'methods'
    | 'provide'
    | 'inject'
    | 'mixins'
    | 'extends'
    | 'setup'
    | 'data'
  > &
    ThisType<
      Omit<OptionsInstance, '$options'> & {
        $options: typeof options
      }
    >,
): {
  props?: string extends RuntimePropsKeys
    ? ComponentObjectPropsOptions extends RuntimePropsOptions
      ? {}
      : RuntimePropsOptions
    : RuntimePropsKeys[]
  emits?: string extends RuntimeEmitsKeys
    ? ObjectEmitsOptions extends RuntimeEmitsOptions
      ? {}
      : RuntimeEmitsOptions
    : RuntimeEmitsKeys[]
  components?: LocalComponents & GlobalComponents
  directives?: Directives & GlobalDirectives
  slots?: Slots
  expose?: Exposed[]
  computed?: Computed
  methods?: Methods
  provide?: Provide
  inject?: string extends InjectKeys ? InjectOptions : InjectKeys[]
  mixins?: Mixin[]
  extends?: Extends
  setup?(): SetupBindings
  data?(): Data
  __typeProps?: TypeProps
  __typeEmits?: TypeEmits
  __typeRefs?: TypeRefs
  __typeEl?: TypeEl
  /**
   * #3468
   *
   * type-only, used to assist Mixin's type inference,
   * typescript will try to simplify the inferred `Mixin` type,
   * with the `__differentiator`, typescript won't be able to combine different mixins,
   * because the `__differentiator` will be different
   */
  __differentiator?: keyof Data | keyof Computed | keyof Methods
  new (...args: any[]): ReturnInstance
} & Omit<
  ComponentOptionsBase,
  | 'props'
  | 'emits'
  | 'components'
  | 'directives'
  | 'slots'
  | 'expose'
  | 'computed'
  | 'methods'
  | 'provide'
  | 'inject'
  | 'mixins'
  | 'extends'
  | 'setup'
  | 'data'
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
