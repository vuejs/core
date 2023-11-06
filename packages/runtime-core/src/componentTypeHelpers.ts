// import { DefineComponent } from './apiDefineComponent'
import { Props } from 'packages/server-renderer/src/render'
import { ComponentOptionsBase, ExtractPropTypes } from '.'
import { DefineComponent, RawOptionsSymbol } from './apiDefineComponent'
import { EmitsOptions, EmitsToProps } from './componentEmits'
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

export type ComponentProps<
  T,
  excludeEmits extends boolean = false
> = (excludeEmits extends false ? ComponentEmits<T> : {}) &
  (ExtractComponentOptions<T> extends {
    props: infer P
  }
    ? P extends Array<infer V>
      ? V extends string
        ? Readonly<{ [key in V]?: any }>
        : {}
      : ExtractPropTypes<P>
    : T extends ComponentOptionsBase<
        infer P,
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
    ? P
    : {})

export type ExtractComponentProp<T> = T extends {
  [RawOptionsSymbol]: infer Options
}
  ? Options
  : T extends { props: infer P }
  ? P
  : T extends (props: infer P) => any
  ? P
  : T extends { new (): { $props: infer P } }
  ? P
  : {}

export type ComponentSlots = {}
export type ExtractComponentSlots = {}

export type ComponentEmits<T> = ExtractComponentOptions<T> extends {
  emits: infer E extends EmitsOptions
}
  ? EmitsToProps<E>
  : T extends (props: any, opts: { emits: infer E extends EmitsOptions }) => any
  ? EmitsToProps<E>
  : {}
export type ExtractComponentEmits = {}

export type ComponentInternalInstance = {}
export type ComponentInstance = {}

// export type ComponentExposed = {}
