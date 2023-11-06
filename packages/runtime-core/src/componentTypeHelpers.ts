// import { DefineComponent } from './apiDefineComponent'
import { ComponentOptionsBase } from '.'
import { DefineComponent, RawOptionsSymbol } from './apiDefineComponent'
// import { ComponentOptionsBase } from './componentOptions'

export type ExtractComponentOptions<T> = T extends {
  [RawOptionsSymbol]: infer Options
}
  ? Options
  : T extends ComponentOptionsBase<
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
  ? T
  : never

export type ComponentProps = {}
export type ExtraComponentProp = {}

export type ComponentSlots = {}
export type ExtractComponentSlots = {}

export type ComponentEmits = {}
export type ExtractComponentEmits = {}

export type ComponentInternalInstance = {}
export type ComponentInstance = {}

// export type ComponentExposed = {}
