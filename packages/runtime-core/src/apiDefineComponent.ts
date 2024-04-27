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
} from './componentProps'
import type {
  ComponentEmitsOptions,
  EmitsToProps,
  TypeEmitsToOptions,
} from './componentEmits'
import { extend, isFunction } from '@vue/shared'
import type { VNodeProps } from './vnode'
import type {
  ComponentPublicInstanceConstructor,
  CreateComponentPublicInstance,
} from './componentPublicInstance'
import type { SlotsType } from './componentSlots'
import type { Directive } from './directives'
import type { ComponentTypeEmits } from './apiSetupHelpers'

export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

type ResolveProps<
  PropsOrPropOptions,
  E extends ComponentEmitsOptions,
> = Readonly<
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
  E extends ComponentEmitsOptions = {},
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
    MakeDefaultsOptional,
    {},
    S,
    LC & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed
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
  E extends ComponentEmitsOptions = {},
  S extends SlotsType = SlotsType,
  Props = P & EmitsToProps<E>,
  PP = PublicProps,
> = new (
  props: Props & PP,
) => CreateComponentPublicInstance<
  Props,
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
>

// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
// (uses user defined props interface)
export function defineComponent<
  Props extends Record<string, any>,
  E extends ComponentEmitsOptions = {},
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
  E extends ComponentEmitsOptions = {},
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
  PropsOptions extends
    ComponentObjectPropsOptions = ComponentObjectPropsOptions,
  PropsKeys extends string = string,
  // emits
  TypeEmits extends ComponentTypeEmits = {},
  EmitsOptions extends ComponentEmitsOptions = {},
  EmitsKeys extends string = string,
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
  ResolvedEmits extends ComponentEmitsOptions = {} extends EmitsOptions
    ? TypeEmitsToOptions<TypeEmits>
    : EmitsOptions,
  InferredProps = unknown extends TypeProps
    ? string extends PropsKeys
      ? ComponentObjectPropsOptions extends PropsOptions
        ? {}
        : ExtractPropTypes<PropsOptions>
      : { [key in PropsKeys]?: any }
    : TypeProps,
  ResolvedProps = Readonly<InferredProps & EmitsToProps<ResolvedEmits>>,
>(
  options: {
    props?: (PropsOptions & ThisType<void>) | PropsKeys[]
    /**
     * @private for language-tools use only
     */
    __typeProps?: TypeProps
    /**
     * @private for language-tools use only
     */
    __typeEmits?: TypeEmits
  } & ComponentOptionsBase<
    ResolvedProps,
    SetupBindings,
    Data,
    Computed,
    Methods,
    Mixin,
    Extends,
    EmitsOptions,
    EmitsKeys,
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
      CreateComponentPublicInstance<
        ResolvedProps,
        SetupBindings,
        Data,
        Computed,
        Methods,
        Mixin,
        Extends,
        ResolvedEmits,
        EmitsKeys,
        {},
        false,
        InjectOptions,
        Slots,
        LocalComponents,
        Directives,
        Exposed
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
  EmitsKeys,
  PublicProps,
  ResolvedProps,
  ExtractDefaultPropTypes<PropsOptions>,
  Slots,
  LocalComponents,
  Directives,
  Exposed,
  Provide,
  // MakeDefaultsOptional - if TypeProps is provided, set to false to use
  // user props types verbatim
  unknown extends TypeProps ? true : false
>

// implementation, close to no-op
/*! #__NO_SIDE_EFFECTS__ */
export function defineComponent(
  options: unknown,
  extraOptions?: ComponentOptions,
) {
  return isFunction(options)
    ? // #8326: extend call and options.name access are considered side-effects
      // by Rollup, so we have to wrap it in a pure-annotated IIFE.
      /*#__PURE__*/ (() =>
        extend({ name: options.name }, extraOptions, { setup: options }))()
    : options
}
