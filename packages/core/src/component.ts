import { EMPTY_OBJ } from './utils'
import { VNode, Slots, RenderNode, RenderFragment } from './vdom'
import {
  Data,
  RenderFunction,
  ComponentOptions,
  ComponentPropsOptions,
  WatchOptions
} from './componentOptions'
import { setupWatcher } from './componentWatch'
import { Autorun, DebuggerEvent, ComputedGetter } from '@vue/observer'
import { nextTick } from '@vue/scheduler'
import { ErrorTypes } from './errorHandling'

type Flatten<T> = { [K in keyof T]: T[K] }

export interface ComponentClass extends Flatten<typeof InternalComponent> {
  new <D = Data, P = Data>(): D & P & MountedComponent<D, P>
}

export interface FunctionalComponent<P = Data> extends RenderFunction<P> {
  pure?: boolean
  props?: ComponentPropsOptions<P>
  inheritAttrs?: boolean
}

export type ComponentType = ComponentClass | FunctionalComponent

// this interface is merged with the class type
// to represent a mounted component
export interface MountedComponent<D = Data, P = Data>
  extends InternalComponent {
  $vnode: VNode
  $data: D
  $props: P
  $attrs: Data
  $computed: Data
  $slots: Slots
  $root: MountedComponent
  $children: MountedComponent[]
  $options: ComponentOptions<D, P>

  render(props: P, slots: Slots, attrs: Data): any
  renderError?(e: Error): any
  renderTracked?(e: DebuggerEvent): void
  renderTriggered?(e: DebuggerEvent): void
  data?(): Partial<D>
  beforeCreate?(): void
  created?(): void
  beforeMount?(): void
  mounted?(): void
  beforeUpdate?(vnode: VNode): void
  updated?(vnode: VNode): void
  beforeUnmount?(): void
  unmounted?(): void
  errorCaptured?(): (err: Error, type: ErrorTypes) => boolean | void
  activated?(): void
  deactivated?(): void

  _updateHandle: Autorun
  _queueJob: ((fn: () => void) => void)
  $forceUpdate: () => void
  $nextTick: (fn: () => void) => Promise<any>

  _self: MountedComponent<D, P> // on proxies only
}

class InternalComponent {
  public static options?: ComponentOptions

  public get $el(): RenderNode | RenderFragment | null {
    return this.$vnode && this.$vnode.el
  }

  public $vnode: VNode | null = null
  public $parentVNode: VNode | null = null
  public $data: Data | null = null
  public $props: Data | null = null
  public $attrs: Data | null = null
  public $computed: Data | null = null
  public $slots: Slots | null = null
  public $root: MountedComponent | null = null
  public $parent: MountedComponent | null = null
  public $children: MountedComponent[] = []
  public $options: any
  public $refs: Record<string, MountedComponent | RenderNode> = {}
  public $proxy: any = null
  public $forceUpdate: (() => void) | null = null

  public _rawData: Data | null = null
  public _computedGetters: Record<string, ComputedGetter> | null = null
  public _watchHandles: Set<Autorun> | null = null
  public _mounted: boolean = false
  public _unmounted: boolean = false
  public _events: { [event: string]: Function[] | null } | null = null
  public _updateHandle: Autorun | null = null
  public _queueJob: ((fn: () => void) => void) | null = null
  public _revokeProxy: () => void
  public _isVue: boolean = true
  public _inactiveRoot: boolean = false

  constructor(options?: ComponentOptions) {
    this.$options = options || (this.constructor as any).options || EMPTY_OBJ
    // root instance
    if (options !== void 0) {
      // mount this
    }
  }

  $nextTick(fn: () => any): Promise<any> {
    return nextTick(fn)
  }

  $watch(
    this: MountedComponent,
    keyOrFn: string | (() => any),
    cb: (newValue: any, oldValue: any) => void,
    options?: WatchOptions
  ) {
    return setupWatcher(this, keyOrFn, cb, options)
  }

  // eventEmitter interface
  $on(this: MountedComponent, event: string, fn: Function): MountedComponent {
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

  $once(this: MountedComponent, event: string, fn: Function): MountedComponent {
    const onceFn = (...args: any[]) => {
      this.$off(event, onceFn)
      fn.apply(this, args)
    }
    ;(onceFn as any).fn = fn
    return this.$on(event, onceFn)
  }

  $off(
    this: MountedComponent,
    event?: string,
    fn?: Function
  ): MountedComponent {
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

  $emit(
    this: MountedComponent,
    name: string,
    ...payload: any[]
  ): MountedComponent {
    const parentListener =
      this.$props['on' + name] || this.$props['on' + name.toLowerCase()]
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
