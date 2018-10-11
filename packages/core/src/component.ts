import { EMPTY_OBJ } from './utils'
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

export interface ComponentClass extends ComponentClassOptions {
  options?: ComponentOptions
  new <P extends object = {}, D extends object = {}>(): MergedComponent<P, D>
}

export type MergedComponent<P, D> = D & P & ComponentInstance<P, D>

export interface FunctionalComponent<P = {}> {
  (props: Readonly<P>, slots: Slots, attrs: Data): any
  pure?: boolean
  props?: ComponentPropsOptions<P>
  displayName?: string
}

export type ComponentType = ComponentClass | FunctionalComponent

export interface ComponentInstance<P = {}, D = {}> extends InternalComponent {
  constructor: ComponentClass

  $vnode: MountedVNode
  $data: D
  $props: Readonly<P>
  $attrs: Data
  $slots: Slots
  $root: ComponentInstance
  $children: ComponentInstance[]

  data?(): Partial<D>
  render(props: Readonly<P>, slots: Slots, attrs: Data): any
  renderError?(e: Error): any
  renderTracked?(e: DebuggerEvent): void
  renderTriggered?(e: DebuggerEvent): void
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
    target: ComponentInstance
  ) => boolean | void
  activated?(): void
  deactivated?(): void

  _updateHandle: Autorun
  _queueJob: ((fn: () => void) => void)
  $forceUpdate: () => void
  $nextTick: (fn: () => void) => Promise<any>

  _self: ComponentInstance<D, P> // on proxies only
}

class InternalComponent {
  public get $el(): RenderNode | null {
    return this.$vnode && this.$vnode.el
  }

  public $vnode: VNode | null = null
  public $parentVNode: VNode | null = null
  public $data: Data | null = null
  public $props: Data | null = null
  public $attrs: Data | null = null
  public $slots: Slots | null = null
  public $root: ComponentInstance | null = null
  public $parent: ComponentInstance | null = null
  public $children: ComponentInstance[] = []
  public $options: ComponentOptions
  public $refs: Record<string, ComponentInstance | RenderNode> = {}
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

  constructor() {
    initializeComponentInstance(this as any)
  }

  $nextTick(fn: () => any): Promise<any> {
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
