import { EMPTY_OBJ } from './utils'
import { VNode, Slots, RenderNode, RenderFragment } from './vdom'
import {
  Data,
  RenderFunction,
  ComponentOptions,
  ComponentPropsOptions
} from './componentOptions'
import { setupWatcher } from './componentWatch'
import { Autorun, DebuggerEvent, ComputedGetter } from '@vue/observer'
import { nextTick } from '@vue/scheduler'

type Flatten<T> = { [K in keyof T]: T[K] }

export interface ComponentClass extends Flatten<typeof Component> {
  new <D = Data, P = Data>(): MountedComponent<D, P> & D & P
}

export interface FunctionalComponent<P = Data> extends RenderFunction<P> {
  pure?: boolean
  props?: ComponentPropsOptions<P>
}

// this interface is merged with the class type
// to represent a mounted component
export interface MountedComponent<D = Data, P = Data> extends Component {
  $vnode: VNode
  $data: D
  $props: P
  $computed: Data
  $slots: Slots
  $root: MountedComponent
  $children: MountedComponent[]
  $options: ComponentOptions<D, P>

  render: RenderFunction<P>
  renderError?: (e: Error) => any
  data?(): Partial<D>
  beforeCreate?(): void
  created?(): void
  beforeMount?(): void
  mounted?(): void
  beforeUpdate?(e: DebuggerEvent): void
  updated?(): void
  beforeDestroy?(): void
  destroyed?(): void

  _updateHandle: Autorun
  _queueJob: ((fn: () => void) => void)
  $forceUpdate: () => void
  $nextTick: (fn: () => void) => Promise<any>

  _self: MountedComponent<D, P> // on proxies only
}

export class Component {
  public static options?: ComponentOptions

  public get $el(): RenderNode | RenderFragment | null {
    return this.$vnode && this.$vnode.el
  }

  public $vnode: VNode | null = null
  public $parentVNode: VNode | null = null
  public $data: Data | null = null
  public $props: Data | null = null
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
  public _destroyed: boolean = false
  public _events: { [event: string]: Function[] | null } | null = null
  public _updateHandle: Autorun | null = null
  public _queueJob: ((fn: () => void) => void) | null = null
  public _revokeProxy: () => void
  public _isVue: boolean = true

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
    cb: () => void
  ) {
    return setupWatcher(this, keyOrFn, cb)
  }

  // eventEmitter interface
  $on(event: string, fn: Function): Component {
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

  $once(event: string, fn: Function): Component {
    const onceFn = (...args: any[]) => {
      this.$off(event, onceFn)
      fn.apply(this, args)
    }
    ;(onceFn as any).fn = fn
    return this.$on(event, onceFn)
  }

  $off(event?: string, fn?: Function) {
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

  $emit(this: MountedComponent, name: string, ...payload: any[]) {
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
