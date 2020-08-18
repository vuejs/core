import {
  ComputedOptions,
  MethodOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps,
  ComponentOptionsMixin,
  RenderFunction
} from './componentOptions'
import {
  SetupContext,
  AllowedComponentProps,
  ComponentCustomProps
} from './component'
import { ExtractPropTypes, ComponentPropsOptions } from './componentProps'
import { EmitsOptions } from './componentEmits'
import { isFunction } from '@vue/shared'
import { VNodeProps } from './vnode'
import {
  CreateComponentPublicInstance,
  ComponentPublicInstance
} from './componentProxy'

declare const DefineComponent: unique symbol
declare const JSX: unique symbol

export interface DefineComponentJSX<T extends ComponentPublicInstance> {
  [JSX]: true
}

export type DefineComponent<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = Record<string, any>,
  PublicProps = {}
> = CreateComponentPublicInstance<
  Props,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  PublicProps
> & { [DefineComponent]: true } & DefineComponentJSX<
    CreateComponentPublicInstance<
      Props,
      RawBindings,
      D,
      C,
      M,
      Mixin,
      Extends,
      E,
      PublicProps
    >
  >

// newDefineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// overload 1: direct setup function
// (uses user defined props interface)
export function newDefineComponent<Props, RawBindings = object>(
  setup: (
    props: Readonly<Props>,
    ctx: SetupContext
  ) => RawBindings | RenderFunction
): DefineComponent<
  Props,
  RawBindings,
  {},
  {},
  {},
  {},
  {},
  {},
  // public props
  VNodeProps & Props & AllowedComponentProps & ComponentCustomProps
>

// overload 2: object format with no props
// (uses user defined props interface)
// return type is for Vetur and TSX support
export function newDefineComponent<
  Props = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = Record<string, any>,
  EE extends string = string
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
    EE
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
  VNodeProps & Props & AllowedComponentProps & ComponentCustomProps
>

// overload 3: object format with array props declaration
// props inferred as { [key in PropNames]?: any }
// return type is for Vetur and TSX support
export function newDefineComponent<
  PropNames extends string,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = Record<string, any>,
  EE extends string = string
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
    EE
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
  AllowedComponentProps & ComponentCustomProps
>

// overload 4: object format with object props declaration
// see `ExtractPropTypes` in ./componentProps.ts
export function newDefineComponent<
  // the Readonly constraint allows TS to treat the type of { required: true }
  // as constant instead of boolean.
  PropsOptions extends Readonly<ComponentPropsOptions>,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = Record<string, any>,
  EE extends string = string
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
    EE
  >
): DefineComponent<
  ExtractPropTypes<PropsOptions, false>,
  RawBindings,
  D,
  C,
  M,
  Mixin,
  Extends,
  E,
  VNodeProps & AllowedComponentProps & ComponentCustomProps
>

// implementation, close to no-op
export function newDefineComponent(options: unknown) {
  return isFunction(options) ? { setup: options, name: options.name } : options
}
