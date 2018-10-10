import { ComponentInstance } from './component'
import { Slots } from './vdom'

export type Data = Record<string, any>

export interface ComponentClassOptions<This = ComponentInstance> {
  props?: ComponentPropsOptions
  computed?: ComponentComputedOptions<This>
  watch?: ComponentWatchOptions<This>
  displayName?: string
}

export interface ComponentOptions<This = ComponentInstance>
  extends ComponentClassOptions<This> {
  data?(): object
  render?: (this: This, props: Readonly<Data>, slots: Slots, attrs: Data) => any
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
  type?: PropType<T> | true | null
  required?: boolean
  default?: T | null | undefined | (() => T | null | undefined)
  validator?(value: T): boolean
}

export interface ComponentComputedOptions<This = ComponentInstance> {
  [key: string]: ((this: This, c: This) => any) | SingleComputedOptions<This>
}

type SingleComputedOptions<This> = {
  get: (this: This, c: This) => any
  set?: (value: any) => void
  cache?: boolean
}

export interface ComponentWatchOptions<This = ComponentInstance> {
  [key: string]: ComponentWatchOption<This>
}

export type ComponentWatchOption<This = ComponentInstance> =
  | WatchHandler<This>
  | WatchHandler<This>[]
  | WatchOptionsWithHandler<This>
  | string

export type WatchHandler<This = any> = (
  this: This,
  val: any,
  oldVal: any
) => void

export interface WatchOptionsWithHandler<This = any> extends WatchOptions {
  handler: WatchHandler<This>
}

export interface WatchOptions {
  sync?: boolean
  deep?: boolean
  immediate?: boolean
}
