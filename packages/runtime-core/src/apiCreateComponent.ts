import {
  ComputedOptions,
  MethodOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithObjectProps
} from './apiOptions'
import { SetupContext, RenderFunction } from './component'
import { ComponentPublicInstance } from './componentProxy'
import { ExtractPropTypes } from './componentProps'
import { isFunction } from '@vue/shared'
import { Ref } from '@vue/reactivity'

interface BaseProps {
  [key: string]: any
  key?: string | number
  ref?: string | Ref | Function
}

// overload 1: direct setup function
// (uses user defined props interface)
// __isConstructor: true is a type-only differentiator to avoid returned
// constructor type from being matched as an options object in h()
export function createComponent<Props, RawBindings = object>(
  setup: (props: Props, ctx: SetupContext) => RawBindings | RenderFunction
): {
  __isConstructor: true
  new (): ComponentPublicInstance<
    Props,
    RawBindings,
    {},
    {},
    {},
    // public props
    BaseProps & Props
  >
}

// overload 2: object format with no props
// (uses user defined props interface)
// return type is for Vetur and TSX support
export function createComponent<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {}
>(
  options: ComponentOptionsWithoutProps<Props, RawBindings, D, C, M>
): {
  __isConstructor: true
  new (): ComponentPublicInstance<
    Props,
    RawBindings,
    D,
    C,
    M,
    BaseProps & Props
  >
}

// overload 3: object format with array props declaration
// props inferred as { [key in PropNames]?: any }
// return type is for Vetur and TSX support
export function createComponent<
  PropNames extends string,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {}
>(
  options: ComponentOptionsWithArrayProps<PropNames, RawBindings, D, C, M>
): {
  __isConstructor: true
  // array props technically doesn't place any contraints on props in TSX
  new (): ComponentPublicInstance<BaseProps, RawBindings, D, C, M>
}

// overload 4: object format with object props declaration
// see `ExtractPropTypes` in ./componentProps.ts
export function createComponent<
  PropsOptions,
  RawBindings,
  D,
  C extends ComputedOptions = {},
  M extends MethodOptions = {}
>(
  options: ComponentOptionsWithObjectProps<PropsOptions, RawBindings, D, C, M>
): {
  __isConstructor: true
  // for Vetur and TSX support
  new (): ComponentPublicInstance<
    ExtractPropTypes<PropsOptions, false>,
    RawBindings,
    D,
    C,
    M,
    BaseProps & ExtractPropTypes<PropsOptions, false>
  >
}

// implementation, close to no-op
export function createComponent(options: unknown) {
  return isFunction(options) ? { setup: options } : options
}
