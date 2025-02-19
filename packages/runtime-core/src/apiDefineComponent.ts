import { type LooseRequired, extend, isFunction } from '@vue/shared'
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
  IsNever,
  ObjectEmitsOptions,
  TypeEmitsToOptions,
} from './componentEmits'
import type {
  ComponentInjectOptions,
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

export type DefineComponent<
  OptionsOrPropsOrPropOptions = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  Mixin = {},
  Extends = {},
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
> = OptionsOrPropsOrPropOptions extends { props?: any }
  ? InferComponentOptions<OptionsOrPropsOrPropOptions>
  : InferComponentOptions<{
      props?: OptionsOrPropsOrPropOptions extends ComponentPropsOptions
        ? OptionsOrPropsOrPropOptions
        : {}
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
      __typeProps?: OptionsOrPropsOrPropOptions extends ComponentPropsOptions
        ? unknown
        : OptionsOrPropsOrPropOptions
      __typeRefs?: TypeRefs
      __typeEl?: TypeEl
    }>

type InferComponentOptions<T> = T &
  (T extends {
    props?: infer PropsOptions
    emits?: infer RuntimeEmitsOptions
    slots?: infer Slots
    expose?: (infer Exposed)[]
    computed?: infer Computed
    methods?: infer Methods
    mixins?: (infer Mixin)[]
    extends?: infer Extends
    setup?(): infer SetupBindings
    data?(): infer Data
    __typeProps?: infer TypeProps
    __typeEmits?: infer TypeEmits
    __typeRefs?: infer TypeRefs
    __typeEl?: infer TypeEl
  }
    ? {
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
          Readonly<
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
                // CompleteEmits
                ExtractMixinEmits<Mixin> &
                  ExtractMixinEmits<Extends> &
                  (unknown extends TypeEmits
                    ? IsNever<RuntimeEmitsOptions> extends true
                      ? {}
                      : RuntimeEmitsOptions extends (infer Keys extends
                            string)[]
                        ? { [K in Keys]: (...args: any) => any }
                        : RuntimeEmitsOptions
                    : {}) &
                  TypeEmitsToOptions<TypeEmits & {}>
              >
          >,
          ExtractMixinSetupBindings<Mixin> &
            ExtractMixinSetupBindings<Extends> &
            SetupBindings,
          ExtractMixinData<Mixin> &
            ExtractMixinData<Extends> &
            EnsureNonVoid<Data>,
          ExtractMixinComputed<Mixin> &
            ExtractMixinComputed<Extends> &
            Computed & {},
          ExtractMixinMethods<Mixin> &
            ExtractMixinMethods<Extends> &
            Methods & {},
          // CompleteEmits
          ExtractMixinEmits<Mixin> &
            ExtractMixinEmits<Extends> &
            (unknown extends TypeEmits
              ? IsNever<RuntimeEmitsOptions> extends true
                ? {}
                : RuntimeEmitsOptions extends (infer Keys extends string)[]
                  ? { [K in Keys]: (...args: any) => any }
                  : RuntimeEmitsOptions
              : {}) &
            TypeEmitsToOptions<TypeEmits & {}>,
          PublicProps,
          ExtractDefaultPropTypes<
            ExtractMixinProps<Mixin> & ExtractMixinProps<Extends> & PropsOptions
          >,
          // MakeDefaultsOptional - if TypeProps is provided, set to false to use
          // user props types verbatim
          unknown extends TypeProps ? true : false,
          {}, // InjectOptions
          Slots & {},
          Exposed & string,
          TypeRefs & {},
          TypeEl & Element
        >
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
    : {})

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
    props?: (keyof Props)[]
    emits?: E | EE[]
    slots?: S
  },
): DefineSetupFnComponent<Props, E, S>
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
  // input inference
  TypeProps,
  TypeEmits extends ComponentTypeEmits | unknown = unknown,
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
  PropsOptions extends ComponentPropsOptions = {},
  RuntimeEmitsOptions extends EmitsOptions = never,
  InjectOptions extends ComponentInjectOptions = {},
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
  Exposed extends string = string,
  // assisted input types
  _PropsKeys extends string = string,
  _EmitsKeys extends string = string,
  _InjectKeys extends string = string,
  // merged types
  CompleteProps = ExtractMixinProps<Mixin> &
    ExtractMixinProps<Extends> &
    (unknown extends TypeProps
      ? PropsOptions extends (infer Keys extends string)[]
        ? { [K in Keys]: null }
        : PropsOptions
      : {}),
  CompleteBindings = ExtractMixinSetupBindings<Mixin> &
    ExtractMixinSetupBindings<Extends> &
    SetupBindings,
  CompleteData = ExtractMixinData<Mixin> &
    ExtractMixinData<Extends> &
    EnsureNonVoid<Data>,
  CompleteComputed extends ComputedOptions = ExtractMixinComputed<Mixin> &
    ExtractMixinComputed<Extends> &
    Computed,
  CompleteMethods extends MethodOptions = ExtractMixinMethods<Mixin> &
    ExtractMixinMethods<Extends> &
    Methods,
  CompleteEmits extends ObjectEmitsOptions = ExtractMixinEmits<Mixin> &
    ExtractMixinEmits<Extends> &
    (unknown extends TypeEmits
      ? IsNever<RuntimeEmitsOptions> extends true
        ? {}
        : RuntimeEmitsOptions extends (infer Keys extends string)[]
          ? { [K in Keys]: (...args: any) => any }
          : RuntimeEmitsOptions
      : {}) &
    TypeEmitsToOptions<TypeEmits & {}>,
  CompleteEmits_Internal extends EmitsOptions = unknown extends TypeEmits
    ? IsNever<RuntimeEmitsOptions> extends true
      ? string[]
      : CompleteEmits
    : CompleteEmits,
  InferredProps = Readonly<
    ExtractPropTypes<CompleteProps> & TypeProps & EmitsToProps<CompleteEmits>
  >,
  // instance types
  DataVM = ComponentPublicInstance<
    InferredProps,
    CompleteBindings,
    CompleteData,
    CompleteComputed,
    CompleteMethods,
    CompleteEmits_Internal,
    {}, // PublicProps
    {}, // Defaults
    false,
    InjectOptions,
    Slots,
    Exposed,
    TypeRefs,
    TypeEl
  >,
  InternalInstance = ComponentPublicInstance<
    InferredProps,
    CompleteBindings,
    CompleteData,
    CompleteComputed,
    CompleteMethods,
    CompleteEmits_Internal,
    {}, // PublicProps
    {}, // Defaults
    false,
    InjectOptions,
    Slots,
    Exposed,
    TypeRefs,
    TypeEl
  >,
>(
  options: {
    props?:
      | ComponentObjectPropsOptions
      | (PropsOptions & ThisType<void>)
      | _PropsKeys[]
    emits?:
      | ObjectEmitsOptions
      | (RuntimeEmitsOptions & ThisType<void>)
      | _EmitsKeys[]
    components?: Record<string, Component> | LocalComponents
    directives?: Record<string, Directive> | Directives
    slots?: Slots
    expose?: Exposed[]
    computed?: Computed
    methods?: Methods
    provide?: Provide
    inject?: ObjectInjectOptions | InjectOptions | _InjectKeys[]
    mixins?: Mixin[]
    extends?: Extends
    setup?: (
      this: void,
      props: NoInfer<LooseRequired<InferredProps>>,
      ctx: NoInfer<SetupContext<CompleteEmits_Internal, Slots>>,
    ) => Promise<SetupBindings> | SetupBindings | RenderFunction | void
    data?: (this: NoInfer<DataVM>, vm: NoInfer<DataVM>) => Data
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
    ThisType<NoInfer<InternalInstance>> &
    ThisType<{
      $options: typeof options
    }>,
): DefineComponent<{
  props?: PropsOptions
  emits?: IsNever<RuntimeEmitsOptions> extends true ? {} : RuntimeEmitsOptions
  components?: LocalComponents & GlobalComponents
  directives?: Directives & GlobalDirectives
  slots?: Slots
  expose?: Exposed[]
  computed?: Computed
  methods?: Methods
  provide?: Provide
  inject?: InjectOptions
  mixins?: Mixin[]
  extends?: Extends
  setup?(): SetupBindings
  data?(): Data
  __typeProps?: TypeProps
  __typeEmits?: TypeEmits
  __typeRefs?: TypeRefs
  __typeEl?: TypeEl
}>

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
