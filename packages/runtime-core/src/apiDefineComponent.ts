import {
  ComputedOptions,
  MethodOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps,
  ComponentOptionsMixin,
  RenderFunction,
  ComponentOptionsBase,
  ComponentOptionClass
} from './componentOptions'
import {
  SetupContext,
  AllowedComponentProps,
  ComponentCustomProps
} from './component'
import {
  ExtractPropTypes,
  ComponentPropsOptions,
  ExtractDefaultPropTypes
} from './componentProps'
import { EmitsOptions } from './componentEmits'
import { isFunction } from '@vue/shared'
import { VNodeProps } from './vnode'
import {
  CreateComponentPublicInstance,
  ComponentPublicInstanceConstructor
} from './componentPublicInstance'

export type PublicProps = VNodeProps &
  AllowedComponentProps &
  ComponentCustomProps

export type DefineComponent<
  PropsOrPropOptions = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = ComputedOptions,
  M extends MethodOptions = MethodOptions,
  Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
  Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
  E extends EmitsOptions = Record<string, any>,
  EE extends string = string,
  PP = PublicProps,
  Props = Readonly<ExtractPropTypes<PropsOrPropOptions>>,
  Defaults = ExtractDefaultPropTypes<PropsOrPropOptions>
> =
  // If props is a class we should ifnore all the process
  (PropsOrPropOptions extends { prototype: ComponentOptionClass }
    ? PropsOrPropOptions
    : ComponentPublicInstanceConstructor<
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
          true
        > &
          Props
      >) &
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
      Defaults
    > &
    PP

// defineComponent is a utility that is primarily used for type inference
// when declaring components. Type inference is provided in the component
// options (provided as the argument). The returned value has artificial types
// for TSX / manual render function / IDE support.

// export function defineComponent<O extends ComponentOptionClass>(
//   // Props = {},
//   // RawBindings = {},
//   // D = {},
//   // C extends ComputedOptions = {},
//   // M extends MethodOptions = {},
//   // Mixin extends ComponentOptionsMixin = ComponentOptionsMixin,
//   // Extends extends ComponentOptionsMixin = ComponentOptionsMixin,
//   // E extends EmitsOptions = EmitsOptions,
//   // EE extends string = string
//   options: O
// ): DefineComponent<Props>

// WORKING
// export function defineComponent<
//   C extends { prototype: B },
//   B extends { prototype: C } = any
// >(o: C): C

// // kind working
// export function defineComponent<O extends { prototype: ComponentOptionClass }>(
//   o: O
// ): DefineComponent<O>

// export function defineComponent<O extends ComponentOptionClass>(
//   o: any
// ): DefineComponent<O>

// export function defineComponent<TClass extends ComponentOptionClass>(

// ) {

// }

// overload 1: direct setup function
// (uses user defined props interface)
export function defineComponent<Props, RawBindings = object>(
  setup: (
    props: Readonly<Props>,
    ctx: SetupContext
  ) => RawBindings | RenderFunction
): DefineComponent<Props, RawBindings>

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
): DefineComponent<Props, RawBindings, D, C, M, Mixin, Extends, E, EE>

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
  EE
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
): DefineComponent<PropsOptions, RawBindings, D, C, M, Mixin, Extends, E, EE>

// overload 4: ComponentOptionClass format to allow more powerful generics
export function defineComponent<O extends { prototype: ComponentOptionClass }>(
  o: O
): DefineComponent<
  O,
  O extends { setup: (...a: any[]) => infer Setup } ? Setup : false
>

// implementation, close to no-op
export function defineComponent(options: unknown) {
  return isFunction(options)
    ? !options.prototype
      ? { setup: options, name: options.name }
      : // @ts-expect-error
        new options()
    : options
}
