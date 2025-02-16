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
  EmitsOptions,
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
  ComponentPublicInstanceConstructor,
  CreateComponentPublicInstanceWithMixins,
  EnsureNonVoid,
  ExtractMixinComputed,
  ExtractMixinData,
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

type ToResolvedProps<Props, Emits extends EmitsOptions> = Readonly<Props> &
  Readonly<EmitsToProps<Emits>>

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
  // input types
  TypeProps,
  TypeEmits extends ComponentTypeEmits = {},
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
  RuntimePropsKeys extends string = string,
  RuntimeEmitsKeys extends string = string,
  InjectKeys extends string = string,
  Exposed extends string = string,
  RuntimePropsOptions extends ComponentObjectPropsOptions = {},
  RuntimeEmitsOptions extends ObjectEmitsOptions = {},
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
  // resolved types
  NormalizedEmitsOptions extends EmitsOptions = (string extends RuntimeEmitsKeys
    ? RuntimeEmitsOptions
    : RuntimeEmitsKeys[]) &
    TypeEmitsToOptions<TypeEmits>,
  InferredProps = (string extends RuntimePropsKeys
    ? ExtractPropTypes<RuntimePropsOptions>
    : { [key in RuntimePropsKeys]?: any }) &
    TypeProps,
  ResolvedProps = ToResolvedProps<InferredProps, NormalizedEmitsOptions>,
  // mixin inference
  PublicP = ExtractMixinProps<Mixin> &
    ExtractMixinProps<Extends> &
    EnsureNonVoid<ResolvedProps>,
  PublicB = ExtractMixinSetupBindings<Mixin> &
    ExtractMixinSetupBindings<Extends> &
    EnsureNonVoid<SetupBindings>,
  PublicD = ExtractMixinData<Mixin> &
    ExtractMixinData<Extends> &
    EnsureNonVoid<Data>,
  PublicC extends ComputedOptions = ExtractMixinComputed<Mixin> &
    ExtractMixinComputed<Extends> &
    EnsureNonVoid<Computed>,
  PublicM extends MethodOptions = ExtractMixinMethods<Mixin> &
    ExtractMixinMethods<Extends> &
    EnsureNonVoid<Methods>,
  PublicDefaults = {}, // TODO
  // vm
  DataVM = CreateComponentPublicInstanceWithMixins<
    ResolvedProps,
    SetupBindings,
    {}, // Data
    {}, // Computed
    MethodOptions,
    Mixin,
    Extends,
    NormalizedEmitsOptions
  >,
  OptionsVM = CreateComponentPublicInstanceWithMixins<
    ResolvedProps,
    SetupBindings,
    Data,
    Computed,
    Methods,
    Mixin,
    Extends,
    NormalizedEmitsOptions,
    {}, // PublicProps
    {}, // Defaults
    false,
    InjectOptions,
    Slots,
    LocalComponents,
    Directives,
    Exposed
  >,
  ReturnVM = CreateComponentPublicInstanceWithMixins<
    ResolvedProps,
    SetupBindings,
    Data,
    Computed,
    Methods,
    Mixin,
    Extends,
    NormalizedEmitsOptions,
    PublicProps,
    ExtractDefaultPropTypes<RuntimePropsOptions>,
    // MakeDefaultsOptional - if TypeProps is provided, set to false to use
    // user props types verbatim
    unknown extends TypeProps ? true : false,
    {}, // InjectOptions
    Slots,
    LocalComponents & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed,
    TypeRefs,
    TypeEl,
    Provide
  >,
>(
  options: {
    props?:
      | (ComponentObjectPropsOptions & (RuntimePropsOptions & ThisType<void>))
      | RuntimePropsKeys[]
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
      props: LooseRequired<PublicP>,
      ctx: SetupContext<NormalizedEmitsOptions, Slots>,
    ) => Promise<SetupBindings> | SetupBindings | RenderFunction | void
    data?: (this: DataVM, vm: DataVM) => Data
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
    ThisType<OptionsVM>,
): {
  props?: string extends RuntimePropsKeys
    ? RuntimePropsOptions
    : RuntimePropsKeys[]
  emits?: string extends RuntimeEmitsKeys
    ? RuntimeEmitsOptions
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
  new (...args: any[]): ReturnVM
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
