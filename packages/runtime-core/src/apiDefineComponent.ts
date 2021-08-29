import {
  ComputedOptions,
  MethodOptions,
  ComponentOptionsMixin,
  RenderFunction,
  BettterComponentOptionsWithObjectProps,
  BetterComponentOptions,
  BettterComponentOptionsWithArrayProps,
  BettterComponentOptionsWithoutProps
} from './componentOptions'
import {
  SetupContext,
  AllowedComponentProps,
  ComponentCustomProps,
  Component,
  BetterComponent
} from './component'
import {
  ExtractPropTypes,
  ExtractDefaultPropTypes,
  ComponentObjectPropsOptions
} from './componentProps'
import { EmitsOptions } from './componentEmits'
import { isFunction } from '@vue/shared'
import { VNodeProps } from './vnode'
import { RenderComponent } from './componentPublicInstance'
import { Slots } from './componentSlots'
import { Directive } from './directives'

export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

// Type Helper for defineComponent return
export type DefineComponent<
  Props extends Record<string, unknown>,
  Emits extends EmitsOptions = {},
  S = {},
  LC extends Record<string, Component> = {},
  LD extends Record<string, Directive> = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Exposed extends string = string,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  Defaults = {},
  Options = any
> = BetterComponent<
  Props,
  Emits,
  S,
  // TODO ADD Similar binding as the BetterCreateComponentPublicInstance
  {},
  LC,
  LD,
  D,
  RawBindings,
  C,
  M,
  Exposed,
  Mixin,
  Extends,
  Options
> &
  RenderComponent<Props, Emits, S, {}, LC, LD, D, Options>

// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
// (uses user defined props interface)
export function defineComponent<
  Props extends Record<string, unknown> = {},
  RawBindings = {},
  Emits extends EmitsOptions = {},
  S = {},
  Exposed extends string = string
>(
  setup: (
    props: Readonly<Props>,
    ctx: SetupContext<Emits, Slots<S>>
  ) => RawBindings | RenderFunction
): DefineComponent<
  Props,
  Emits,
  S,
  {},
  {},
  RawBindings,
  {},
  {},
  {},
  Exposed,
  {},
  {},
  {},
  BetterComponentOptions<
    Props,
    Emits,
    S,
    {},
    {},
    RawBindings,
    {},
    {},
    {},
    string,
    Exposed
  >
>

// overload 2: object format with no props
// (uses user defined props interface)
// return type is for Vetur and TSX support
export function defineComponent<
  Emits extends EmitsOptions = {},
  S = {},
  LC extends Record<string, Component> = {},
  LD extends Record<string, Directive> = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  EE extends string = string,
  Exposed extends string = string,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  Defaults = {}
>(
  options: BettterComponentOptionsWithoutProps<
    Emits,
    S,
    LC,
    LD,
    RawBindings,
    D,
    C,
    M,
    EE,
    Exposed,
    Mixin,
    Extends,
    Defaults
  >
): DefineComponent<
  {},
  Emits,
  S,
  LC,
  LD,
  RawBindings,
  D,
  C,
  M,
  Exposed,
  Mixin,
  Extends,
  Defaults,
  BettterComponentOptionsWithoutProps<
    Emits,
    S,
    LC,
    LD,
    RawBindings,
    D,
    C,
    M,
    EE,
    Exposed,
    Mixin,
    Extends,
    Defaults
  >
>
// overload 3: object format with array props declaration
// props inferred as { [key in PropNames]?: any }
// return type is for Vetur and TSX support
export function defineComponent<
  PropNames extends string,
  Emits extends EmitsOptions = {},
  S = {},
  LC extends Record<string, Component> = {},
  LD extends Record<string, Directive> = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  EE extends string = string,
  Exposed extends string = string,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  Defaults = {},
  Props extends Record<string, unknown> = Readonly<{ [key in PropNames]?: any }>
>(
  options: BettterComponentOptionsWithArrayProps<
    Props,
    Emits,
    S,
    LC,
    LD,
    RawBindings,
    D,
    C,
    M,
    EE,
    Exposed,
    Mixin,
    Extends,
    Defaults,
    PropNames
  >
): DefineComponent<
  Props,
  Emits,
  S,
  LC,
  LD,
  RawBindings,
  D,
  C,
  M,
  Exposed,
  Mixin,
  Extends,
  Defaults,
  BettterComponentOptionsWithArrayProps<
    Props,
    Emits,
    S,
    LC,
    LD,
    RawBindings,
    D,
    C,
    M,
    EE,
    Exposed,
    Mixin,
    Extends,
    Defaults,
    PropNames
  >
>

// overload 4: object format with object props declaration
// see `ExtractPropTypes` in ./componentProps.ts
export function defineComponent<
  PropsOptions extends ComponentObjectPropsOptions = ComponentObjectPropsOptions,
  Emits extends EmitsOptions = {},
  S = {},
  LC extends Record<string, Component> = {},
  LD extends Record<string, Directive> = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  EE extends string = string,
  Exposed extends string = string,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  Defaults = ExtractDefaultPropTypes<PropsOptions>,
  Props extends Record<string, unknown> = Readonly<
    ExtractPropTypes<PropsOptions>
  >
>(
  options: BettterComponentOptionsWithObjectProps<
    Props,
    Emits,
    S,
    LC,
    LD,
    RawBindings,
    D,
    C,
    M,
    EE,
    Exposed,
    Mixin,
    Extends,
    Defaults,
    PropsOptions
  >
): DefineComponent<
  Props,
  Emits,
  S,
  LC,
  LD,
  RawBindings,
  D,
  C,
  M,
  Exposed,
  Mixin,
  Extends,
  Defaults,
  BettterComponentOptionsWithObjectProps<
    Props,
    Emits,
    S,
    LC,
    LD,
    RawBindings,
    D,
    C,
    M,
    EE,
    Exposed,
    Mixin,
    Extends,
    Defaults,
    PropsOptions
  >
>

// implementation, close to no-op
export function defineComponent(options: unknown) {
  return isFunction(options) ? { setup: options, name: options.name } : options
}
