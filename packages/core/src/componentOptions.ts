import { Slots, VNodeData } from './vdom'
import { MountedComponent } from './component'

export type Data = Record<string, any>

export interface RenderFunction<P = Data> {
  (props: P, slots: Slots, attrs: Data, rawData: VNodeData | null): any
}

export interface ComponentOptions<D = Data, P = Data> {
  data?: () => Partial<D>
  props?: ComponentPropsOptions<P>
  computed?: ComponentComputedOptions<D, P>
  watch?: ComponentWatchOptions<D, P>
  render?: RenderFunction<P>
  inheritAttrs?: boolean
  // TODO other options
  readonly [key: string]: any
}

export type ComponentPropsOptions<P = Data> = {
  [K in keyof P]: PropValidator<P[K]>
}

export type Prop<T> = { (): T } | { new (...args: any[]): T & object }

export type PropType<T> = Prop<T> | Prop<T>[]

export type PropValidator<T> = PropOptions<T> | PropType<T>

export interface PropOptions<T = any> {
  type?: PropType<T>
  required?: boolean
  default?: T | null | undefined | (() => T | null | undefined)
  validator?(value: T): boolean
}

export interface ComponentComputedOptions<D = Data, P = Data> {
  [key: string]: (this: MountedComponent<D, P> & D & P, c: any) => any
}

export interface ComponentWatchOptions<D = Data, P = Data> {
  [key: string]: ComponentWatchOption<MountedComponent<D, P> & D & P>
}

export type ComponentWatchOption<C = any> =
  | WatchHandler<C>
  | WatchHandler<C>[]
  | WatchOptionsWithHandler<C>
  | string

export type WatchHandler<C = any> = (this: C, val: any, oldVal: any) => void

export interface WatchOptionsWithHandler<C = any> extends WatchOptions {
  handler: WatchHandler<C>
}

export interface WatchOptions {
  sync?: boolean
  deep?: boolean
  immediate?: boolean
}
