import {
  ComputedOptions,
  MethodOptions,
  ComponentOptionsWithoutProps,
  ComponentOptionsWithArrayProps,
  ComponentOptionsWithProps
} from './apiOptions'
import { SetupContext } from './component'
import { VNodeChild } from './vnode'
import { ComponentPublicInstance } from './componentProxy'
import { ExtractPropTypes } from './componentProps'
import { isFunction } from '@vue/shared'

// overload 1: direct setup function
// (uses user defined props interface)
export function createComponent<Props>(
  setup: (props: Props, ctx: SetupContext) => object | (() => VNodeChild)
): (props: Props) => any

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
  new (): ComponentPublicInstance<Props, RawBindings, D, C, M>
}

// overload 3: object format with array props declaration
// props inferred as { [key in PropNames]?: unknown }
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
  new (): ComponentPublicInstance<
    { [key in PropNames]?: unknown },
    RawBindings,
    D,
    C,
    M
  >
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
  options: ComponentOptionsWithProps<PropsOptions, RawBindings, D, C, M>
): {
  // for Vetur and TSX support
  new (): ComponentPublicInstance<
    ExtractPropTypes<PropsOptions>,
    RawBindings,
    D,
    C,
    M,
    ExtractPropTypes<PropsOptions, false>
  >
}

// implementation, close to no-op
export function createComponent(options: any) {
  return isFunction(options) ? { setup: options } : options
}
