import { Slots } from './vdom'
import { MountedComponent } from './component'

export type Data = Record<string, any>

export interface RenderFunction<P = Data> {
  (props: P, slots: Slots): any
}

export interface ComponentOptions<D = Data, P = Data> {
  data?: () => Partial<D>
  props?: ComponentPropsOptions<P>
  computed?: ComponentComputedOptions<D, P>
  watch?: ComponentWatchOptions<D, P>
  render?: RenderFunction<P>
  // TODO other options
  readonly [key: string]: any
}

export type ComponentPropsOptions<P = Data> = {
  [K in keyof P]: PropValidator<P[K]>
}

export type NormalizedPropsOptions<P = Data> = {
  [K in keyof P]: PropOptions<P[K]>
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
  [key: string]: (
    this: MountedComponent<D, P> & D & P,
    oldValue: any,
    newValue: any
  ) => void
}
