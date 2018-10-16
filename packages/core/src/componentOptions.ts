import {
  Component,
  ComponentInstance,
  ComponentClass,
  APIMethods,
  LifecycleMethods
} from './component'
import { Slots } from './vdom'
import { isArray, isObject, isFunction } from '@vue/shared'
import { normalizePropsOptions } from './componentProps'

export type Data = Record<string, any>

export interface ComponentClassOptions<P = {}, This = ComponentInstance> {
  props?: ComponentPropsOptions<P>
  computed?: ComponentComputedOptions<This>
  watch?: ComponentWatchOptions<This>
  displayName?: string
}

export interface ComponentOptions<
  P = {},
  D = {},
  This = ComponentInstance<P, D>
> extends ComponentClassOptions<P, This> {
  data?(): D
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

type ReservedKeys = { [K in keyof (APIMethods & LifecycleMethods)]: 1 }

export const reservedMethods: ReservedKeys = {
  data: 1,
  render: 1,
  beforeCreate: 1,
  created: 1,
  beforeMount: 1,
  mounted: 1,
  beforeUpdate: 1,
  updated: 1,
  beforeUnmount: 1,
  unmounted: 1,
  errorCaptured: 1,
  activated: 1,
  deactivated: 1,
  renderTracked: 1,
  renderTriggered: 1
}

// This is called in the base component constructor and the return value is
// set on the instance as $options.
export function resolveComponentOptionsFromClass(
  Class: ComponentClass
): ComponentOptions {
  if (Class.hasOwnProperty('options')) {
    return Class.options as ComponentOptions
  }
  let options = {} as any

  const staticDescriptors = Object.getOwnPropertyDescriptors(Class)
  for (const key in staticDescriptors) {
    const { enumerable, get, value } = staticDescriptors[key]
    if (enumerable || get) {
      options[key] = get ? get() : value
    }
  }

  const instanceDescriptors = Object.getOwnPropertyDescriptors(Class.prototype)
  for (const key in instanceDescriptors) {
    const { get, value } = instanceDescriptors[key]
    if (get) {
      // computed properties
      ;(options.computed || (options.computed = {}))[key] = get
      // there's no need to do anything for the setter
      // as it's already defined on the prototype
    } else if (isFunction(value) && key !== 'constructor') {
      if (key in reservedMethods) {
        options[key] = value
      } else {
        ;(options.methods || (options.methods = {}))[key] = value
      }
    }
  }

  options.props = normalizePropsOptions(options.props)

  const ParentClass = Object.getPrototypeOf(Class)
  if (ParentClass !== Component) {
    const parentOptions = resolveComponentOptionsFromClass(ParentClass)
    options = mergeComponentOptions(parentOptions, options)
  }

  Class.options = options
  return options
}

export function mergeComponentOptions(to: any, from: any): ComponentOptions {
  const res: any = Object.assign({}, to)
  if (from.mixins) {
    from.mixins.forEach((mixin: any) => {
      from = mergeComponentOptions(from, mixin)
    })
  }
  for (const key in from) {
    const value = from[key]
    const existing = res[key]
    if (isFunction(value) && isFunction(existing)) {
      if (key === 'data') {
        // for data we need to merge the returned value
        res[key] = function() {
          return Object.assign(existing.call(this), value.call(this))
        }
      } else if (/^render|^errorCaptured/.test(key)) {
        // render, renderTracked, renderTriggered & errorCaptured
        // are never merged
        res[key] = value
      } else {
        // merge lifecycle hooks
        res[key] = function(...args: any[]) {
          existing.call(this, ...args)
          value.call(this, ...args)
        }
      }
    } else if (isArray(value) && isArray(existing)) {
      res[key] = existing.concat(value)
    } else if (isObject(value) && isObject(existing)) {
      res[key] = Object.assign({}, existing, value)
    } else {
      res[key] = value
    }
  }
  return res
}
