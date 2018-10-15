import { EMPTY_OBJ, NOOP } from './utils'
import { VNode, Slots, RenderNode, MountedVNode } from './vdom'
import {
  Data,
  ComponentOptions,
  ComponentClassOptions,
  ComponentPropsOptions,
  WatchOptions
} from './componentOptions'
import { setupWatcher } from './componentWatch'
import { Autorun, DebuggerEvent, ComputedGetter } from '@vue/observer'
import { nextTick } from '@vue/scheduler'
import { ErrorTypes } from './errorHandling'
import { initializeComponentInstance } from './componentUtils'

// public component instance type
export interface Component<P = {}, D = {}> extends PublicInstanceMethods {
  readonly $el: any
  readonly $vnode: MountedVNode
  readonly $parentVNode: MountedVNode
  readonly $data: D
  readonly $props: Readonly<P>
  readonly $attrs: Readonly<Data>
  readonly $slots: Slots
  readonly $root: Component
  readonly $parent: Component
  readonly $children: Component[]
  readonly $options: ComponentOptions<P, D, this>
  readonly $refs: Record<string | symbol, any>
  readonly $proxy: this
}

interface PublicInstanceMethods {
  $forceUpdate(): void
  $nextTick(fn: () => any): Promise<void>
  $watch(
    keyOrFn: string | ((this: this) => any),
    cb: (this: this, newValue: any, oldValue: any) => void,
    options?: WatchOptions
  ): () => void
  $on(event: string, fn: Function): this
  $once(event: string, fn: Function): this
  $off(event?: string, fn?: Function): this
  $emit(name: string, ...payload: any[]): this
}

interface APIMethods<P, D> {
  data?(): Partial<D>
  render(props: Readonly<P>, slots: Slots, attrs: Data, parentVNode: VNode): any
}

interface LifecycleMethods {
  beforeCreate?(): void
  created?(): void
  beforeMount?(): void
  mounted?(): void
  beforeUpdate?(vnode: VNode): void
  updated?(vnode: VNode): void
  beforeUnmount?(): void
  unmounted?(): void
  errorCaptured?(): (
    err: Error,
    type: ErrorTypes,
    instance: ComponentInstance | null,
    vnode: VNode
  ) => boolean | void
  activated?(): void
  deactivated?(): void
  renderTracked?(e: DebuggerEvent): void
  renderTriggered?(e: DebuggerEvent): void
}

export interface ComponentClass extends ComponentClassOptions {
  options?: ComponentOptions
  new <P = {}, D = {}>(): Component<P, D> & D & P
}

export interface FunctionalComponent<P = {}> {
  (props: P, slots: Slots, attrs: Data, parentVNode: VNode): any
  pure?: boolean
  props?: ComponentPropsOptions<P>
  displayName?: string
}

export type ComponentType = ComponentClass | FunctionalComponent

// Internal type that represents a mounted instance.
// It extends InternalComponent with mounted instance properties.
export interface ComponentInstance<P = {}, D = {}>
  extends InternalComponent,
    APIMethods<P, D>,
    LifecycleMethods {
  constructor: ComponentClass

  $vnode: MountedVNode
  $data: D
  $props: P
  $attrs: Data
  $slots: Slots
  $root: ComponentInstance
  $children: ComponentInstance[]

  _updateHandle: Autorun
  _queueJob: ((fn: () => void) => void)
  _self: ComponentInstance<P, D> // on proxies only
}

// actual implementation of the component
class InternalComponent implements PublicInstanceMethods {
  get $el(): any {
    return this.$vnode && this.$vnode.el
  }

  $vnode: VNode | null = null
  $parentVNode: VNode | null = null
  $data: Data | null = null
  $props: Data | null = null
  $attrs: Data | null = null
  $slots: Slots | null = null
  $root: ComponentInstance | null = null
  $parent: ComponentInstance | null = null
  $children: ComponentInstance[] = []
  $options: ComponentOptions
  $refs: Record<string, ComponentInstance | RenderNode> = {}
  $proxy: any = null

  _rawData: Data | null = null
  _computedGetters: Record<string, ComputedGetter> | null = null
  _watchHandles: Set<Autorun> | null = null
  _mounted: boolean = false
  _unmounted: boolean = false
  _events: { [event: string]: Function[] | null } | null = null
  _updateHandle: Autorun | null = null
  _queueJob: ((fn: () => void) => void) | null = null
  _isVue: boolean = true
  _inactiveRoot: boolean = false

  constructor() {
    initializeComponentInstance(this as any)
  }

  // to be set by renderer during mount
  $forceUpdate: () => void = NOOP

  $nextTick(fn: () => any): Promise<void> {
    return nextTick(fn)
  }

  $watch(
    keyOrFn: string | ((this: this) => any),
    cb: (this: this, newValue: any, oldValue: any) => void,
    options?: WatchOptions
  ): () => void {
    return setupWatcher(this as any, keyOrFn, cb, options)
  }

  // eventEmitter interface
  $on(event: string, fn: Function): this {
    if (Array.isArray(event)) {
      for (let i = 0; i < event.length; i++) {
        this.$on(event[i], fn)
      }
    } else {
      const events = this._events || (this._events = Object.create(null))
      ;(events[event] || (events[event] = [])).push(fn)
    }
    return this
  }

  $once(event: string, fn: Function): this {
    const onceFn = (...args: any[]) => {
      this.$off(event, onceFn)
      fn.apply(this, args)
    }
    ;(onceFn as any).fn = fn
    return this.$on(event, onceFn)
  }

  $off(event?: string, fn?: Function): this {
    if (this._events) {
      if (!event && !fn) {
        this._events = null
      } else if (Array.isArray(event)) {
        for (let i = 0; i < event.length; i++) {
          this.$off(event[i], fn)
        }
      } else if (!fn) {
        this._events[event as string] = null
      } else {
        const fns = this._events[event as string]
        if (fns) {
          for (let i = 0; i < fns.length; i++) {
            const f = fns[i]
            if (fn === f || fn === (f as any).fn) {
              fns.splice(i, 1)
              break
            }
          }
        }
      }
    }
    return this
  }

  $emit(name: string, ...payload: any[]): this {
    const parentData =
      (this.$parentVNode && this.$parentVNode.data) || EMPTY_OBJ
    const parentListener =
      parentData['on' + name] || parentData['on' + name.toLowerCase()]
    if (parentListener) {
      invokeListeners(parentListener, payload)
    }
    if (this._events) {
      const handlers = this._events[name]
      if (handlers) {
        invokeListeners(handlers, payload)
      }
    }
    return this
  }
}

function invokeListeners(value: Function | Function[], payload: any[]) {
  // TODO handle error
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i](...payload)
    }
  } else {
    value(...payload)
  }
}

// the exported Component has the implementation details of the actual
// InternalComponent class but with proper type inference of ComponentClass.
export const Component = InternalComponent as ComponentClass
