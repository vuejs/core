import { extend, isFunction } from '@vue/shared'
import type { ComponentTypeEmits } from './apiSetupHelpers'
import type {
  AllowedComponentProps,
  Component,
  ComponentCustomProps,
  Data,
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
import type { CreateComponentPublicInstanceWithMixins } from './componentPublicInstance'
import type { SlotsType } from './componentSlots'
import type { Directive } from './directives'
import type { VNodeProps } from './vnode'

export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

export interface ComponentOptionsSchema {
  setup(): unknown
  data(): unknown
  props: ComponentPropsOptions
  computed: ComputedOptions
  methods: MethodOptions
  mixins: ComponentOptionsMixin[]
  extends: ComponentOptionsMixin
  emits: EmitsOptions
  slots: SlotsType
  inject: ComponentInjectOptions
  components: Record<string, Component>
  directives: Record<string, Directive>
  provide: ComponentProvideOptions
  expose: string
  __defaults: unknown
  __typeProps: unknown
  __typeEmits: unknown
  __typeRefs: Data
  __typeEl: Element
}

export type DefineComponent<
  PropsOrPropOptions = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  Mixin extends ComponentOptionsMixin = {},
  Extends extends ComponentOptionsMixin = {},
  E extends EmitsOptions = {},
  EE = never,
  PP = never,
  Props = never,
  Defaults = ExtractDefaultPropTypes<PropsOrPropOptions>,
  S extends SlotsType = {},
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Provide extends ComponentProvideOptions = ComponentProvideOptions,
  MakeDefaultsOptional extends boolean = true,
  TypeRefs extends Record<string, unknown> = {},
  TypeEl extends Element = any,
> = InferComponent<
  {
    setup(): RawBindings
    data(): unknown extends D ? {} : D
    props: PropsOrPropOptions extends ComponentPropsOptions
      ? PropsOrPropOptions
      : {}
    computed: C
    methods: M
    mixins: Mixin[]
    extends: Extends
    emits: Record<string, unknown> extends E ? {} : E
    slots: S
    inject: {}
    components: LC
    directives: Directives
    provide: Provide
    expose: Exposed
    __defaults: Defaults
    __typeProps: PropsOrPropOptions extends ComponentPropsOptions
      ? unknown
      : PropsOrPropOptions
    __typeEmits: unknown
    __typeRefs: TypeRefs
    __typeEl: TypeEl
  },
  MakeDefaultsOptional,
  false
>

export type DefineComponent2<T extends ComponentOptionsSchema> = InferComponent<
  T,
  // MakeDefaultsOptional - if TypeProps is provided, set to false to use
  // user props types verbatim
  unknown extends T['__typeProps'] ? true : false,
  true
>

type InferComponent<
  T extends ComponentOptionsSchema,
  MakeDefaultsOptional extends boolean,
  StrictEmits extends boolean,
  // resolved types
  Mixin extends ComponentOptionsMixin = T['mixins'][number],
  Extends extends ComponentOptionsMixin = T['extends'],
  ResolvedEmits extends ObjectEmitsOptions = ResolveEmitsOptions<
    T['emits'],
    T['__typeEmits']
  >,
  ResolvedTypeEmits = ResolveTypeEmits<T['emits'], T['__typeEmits']>,
  InferredProps = Readonly<
    ExtractPropTypes<
      unknown extends T['__typeProps']
        ? T['props'] extends (infer Keys extends string)[]
          ? { [K in Keys]: null }
          : T['props']
        : {}
    > &
      T['__typeProps'] &
      EmitsToProps<
        ResolvedEmits &
          TypeEmitsToOptions<
            string[] extends T['emits']
              ? T['__typeEmits'] & {}
              : ResolvedTypeEmits & {}
          >
      >
  >,
> = ComponentOptionsBase<
  any,
  ReturnType<T['setup']>,
  ReturnType<T['data']>,
  T['computed'],
  T['methods'],
  T['mixins'][number] & {},
  T['extends'] & {},
  T['emits'],
  never,
  never,
  {},
  never,
  T['slots'],
  T['components'] & GlobalComponents,
  T['directives'] & GlobalDirectives,
  T['expose'],
  T['provide']
> & {
  props?: T['props']
  __typeProps?: T['__typeProps']

  /**
   * #3468
   *
   * type-only, used to assist Mixin's type inference,
   * typescript will try to simplify the inferred `Mixin` type,
   * with the `__differentiator`, typescript won't be able to combine different mixins,
   * because the `__differentiator` will be different
   */
  __differentiator?:
    | keyof ReturnType<T['data']>
    | keyof T['computed']
    | keyof T['methods']

  new (
    ...args: any[]
  ): CreateComponentPublicInstanceWithMixins<
    InferredProps,
    ReturnType<T['setup']>,
    ReturnType<T['data']>,
    T['computed'],
    T['methods'],
    Mixin,
    Extends,
    ResolvedEmits,
    PublicProps,
    unknown extends T['__defaults']
      ? ExtractDefaultPropTypes<T['props']>
      : T['__defaults'],
    MakeDefaultsOptional,
    T['inject'],
    T['slots'],
    T['components'] & GlobalComponents,
    T['directives'] & GlobalDirectives,
    T['expose'],
    T['__typeRefs'],
    T['__typeEl'],
    T['provide'],
    ResolvedTypeEmits,
    StrictEmits,
    any
  >
}

export type DefineSetupFnComponent<
  P extends Record<string, any>,
  E extends EmitsOptions = string[],
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
  Defaults = unknown,
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
  NormalizedProps extends
    ComponentPropsOptions = ComponentPropsOptions extends RawPropsOptions
    ? {}
    : RawPropsOptions,
  NormalizedEmits extends EmitsOptions = EmitsOptions extends RawEmitsOptions
    ? string[]
    : RawEmitsOptions,
  ResolvedEmits extends ObjectEmitsOptions = ResolveEmitsOptions<
    NormalizedEmits,
    TypeEmits
  >,
  ResolvedTypeEmits = ResolveTypeEmits<NormalizedEmits, TypeEmits>,
  InferredProps = Readonly<
    ExtractPropTypes<
      unknown extends TypeProps
        ? NormalizedProps extends (infer Keys extends string)[]
          ? { [K in Keys]: null }
          : NormalizedProps
        : {}
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
    /**
     * @private for language-tools use only
     */
    __defaults?: Defaults
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
    CreateComponentPublicInstanceWithMixins<
      InferredProps,
      SetupBindings,
      {},
      {},
      MethodOptions,
      Mixin,
      Extends
    >
  > &
    ThisType<
      CreateComponentPublicInstanceWithMixins<
        InferredProps,
        SetupBindings,
        Data,
        Computed,
        Methods,
        Mixin,
        Extends,
        ResolvedEmits,
        {}, // PublicProps
        {}, // Defaults
        false,
        InjectOptions,
        Slots,
        {},
        {},
        Exposed,
        TypeRefs,
        TypeEl,
        {},
        ResolvedTypeEmits,
        true,
        {}
      > & {
        $options: typeof options
      }
    >,
): DefineComponent2<{
  setup(): SetupBindings
  data(): Data
  props: NormalizedProps
  computed: Computed
  methods: Methods
  mixins: Mixin[]
  extends: Extends
  emits: NormalizedEmits
  slots: Slots
  inject: {} // omitted
  components: LocalComponents
  directives: Directives
  provide: Provide
  expose: Exposed
  __typeProps: TypeProps
  __typeEmits: TypeEmits
  __typeRefs: TypeRefs
  __typeEl: TypeEl
  __defaults: Defaults
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
