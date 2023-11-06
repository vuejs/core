// import { DefineComponent } from './apiDefineComponent'
import { ComponentOptionsBase } from './componentOptions'

export type ExtractComponentOptions<T> = T extends ComponentOptionsBase<
  infer Props,
  infer RawBindings,
  infer D,
  infer C,
  infer M,
  infer Mixin,
  infer Extends,
  infer E,
  infer EE,
  infer Defaults,
  infer I,
  infer II,
  infer S
>
  ? ComponentOptionsBase<
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
      I,
      II,
      S
    >
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
