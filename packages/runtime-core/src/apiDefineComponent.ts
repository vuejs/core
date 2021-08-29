import {
  ComputedOptions,
  MethodOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps,
  ComponentOptionsMixin,
  RenderFunction,
  ComponentOptionsBase,
  BettterComponentOptionsWithObjectProps,
  BetterComponentOptions,
  BetterComponentOptionsAny,
  BettterComponentOptionsWithArrayProps,
  BettterComponentOptionsWithoutProps
} from './componentOptions'
import {
  SetupContext,
  AllowedComponentProps,
  ComponentCustomProps,
  Component,
  GlobalDirectives,
  GlobalComponents,
  BetterComponent
} from './component'
import {
  ExtractPropTypes,
  ComponentPropsOptions,
  ExtractDefaultPropTypes
} from './componentProps'
import { EmitsOptions, EmitsToProps } from './componentEmits'
import { isFunction } from '@vue/shared'
import { VNodeProps } from './vnode'
import {
  CreateComponentPublicInstance,
  ComponentPublicInstanceConstructor,
  RenderComponent
} from './componentPublicInstance'
import { Slots } from './componentSlots'
import { Directive } from './directives'
import { ComponentObjectPropsOptions, PropType } from 'test-dts'

export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

type FixS<T extends EmitsOptions> = T extends string[]
  ? Record<T[number], null>
  : T

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
  S = any,
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  PP = PublicProps,
  Props = Readonly<ExtractPropTypes<PropsOrPropOptions>>,
  Defaults = ExtractDefaultPropTypes<PropsOrPropOptions>
> = ComponentPublicInstanceConstructor<
  CreateComponentPublicInstance<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    FixS<E>,
    S,
    PP & Props,
    Defaults,
    true,
    LC & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed
  > &
    Readonly<ExtractPropTypes<PropsOrPropOptions>>
> & /**
 * just typescript
 */ { __isDefineComponent?: true } & ComponentOptionsBase<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    S,
    LC & GlobalComponents,
    Directives & GlobalDirectives,
    Exposed,
    Defaults
  > &
  PP

// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
// (uses user defined props interface)
export function defineComponent<
  Props,
  RawBindings = object,
  E extends EmitsOptions = {},
  S = {}
>(
  setup: (
    props: Readonly<Props>,
    ctx: SetupContext<E, Slots<S>>
  ) => RawBindings | RenderFunction
): DefineComponent<Props, RawBindings, {}, any, any, any, any, any, string, S>

// overload 2: object format with no props
// (uses user defined props interface)
// return type is for Vetur and TSX support
export function defineComponent<
  Props = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  S = any,
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string
>(
  options: ComponentOptionsWithoutProps<
    Props,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    S,
    LC,
    Directives,
    Exposed
  >
): DefineComponent<
  Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  S,
  LC,
  Directives,
  Exposed
>

// overload 3: object format with array props declaration
// props inferred as { [key in PropNames]?: any }
// return type is for Vetur and TSX support
export function defineComponent<
  PropNames extends string,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  S = any,
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string
>(
  options: ComponentOptionsWithArrayProps<
    PropNames,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    S,
    LC,
    Directives,
    Exposed
  >
): DefineComponent<
  Readonly<{ [key in PropNames]?: any }>,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  S,
  LC,
  Directives,
  Exposed
>

// overload 4: object format with object props declaration
// see `ExtractPropTypes` in ./componentProps.ts
export function defineComponent<
  // the Readonly constraint allows TS to treat the type of { required: true }
  // as constant instead of boolean.
  PropsOptions extends Readonly<ComponentPropsOptions>,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = {},
  EE extends string = string,
  S = any,
  LC extends Record<string, Component> = {},
  Directives extends Record<string, Directive> = {},
  Exposed extends string = string,
  Props = Readonly<ExtractPropTypes<PropsOptions>>,
  Defaults = ExtractDefaultPropTypes<PropsOptions>
>(
  options: ComponentOptionsWithObjectProps<
    PropsOptions,
    RawBindings,
    D,
    C,
    M,
    Mixin,
    Extends,
    E,
    EE,
    S,
    LC,
    Directives,
    Exposed,
    Props,
    Defaults
  >
): DefineComponent<
  PropsOptions,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  EE,
  S,
  LC,
  Directives,
  Exposed,
  Props,
  Defaults
>

// implementation, close to no-op
export function defineComponent(options: unknown) {
  return isFunction(options) ? { setup: options, name: options.name } : options
}

// Type Helper for defineComponent return
export type BetterDefineComponent<
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
export function betterDefineComponent<
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
): { OOO: number } & BetterDefineComponent<
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
export function betterDefineComponent<
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
): BetterDefineComponent<
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
export function betterDefineComponent<
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
): BetterDefineComponent<
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
export function betterDefineComponent<
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
): BetterDefineComponent<
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
export function betterDefineComponent(options: unknown) {
  return isFunction(options) ? { setup: options, name: options.name } : options
}

const xxx = betterDefineComponent({
  props: ['test']
})

declare function test<
  T extends BetterDefineComponent<
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
>(
  t: T
): T extends BetterComponent<
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
  infer O
>
  ? O
  : { nope: true }

const r = test(
  betterDefineComponent({
    // props: ['ttet']
  })
)

const rrr = betterDefineComponent({
  props: {
    test: Number
  }
})

const rt = betterDefineComponent<{ test: number }>({
  setup() {
    return {
      a: 2
    }
  }
})
rt.OOO
