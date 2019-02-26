import { EMPTY_OBJ, NOOP } from '@vue/shared'
import { VNode, Slots, RenderNode, MountedVNode } from './vdom'
import {
  Data,
  ComponentOptions,
  ComponentClassOptions,
  ComponentPropsOptions,
  WatchOptions
} from './componentOptions'
import { setupWatcher } from './componentWatch'
import { ReactiveEffect, DebuggerEvent, ComputedGetter } from '@vue/observer'
import { nextTick } from '@vue/scheduler'
import { ErrorTypes } from './errorHandling'
import { initializeComponentInstance } from './componentInstance'
import { EventEmitter, invokeListeners } from './optional/eventEmitter'
import { warn } from './warning'

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
  $emit(name: string, ...payload: any[]): void
}

export interface APIMethods<P = {}, D = {}> {
  data(): Partial<D>
  hooks(): any
  render(props: Readonly<P>, slots: Slots, attrs: Data, parentVNode: VNode): any
}

export interface LifecycleMethods {
  beforeCreate(): void
  created(): void
  beforeMount(): void
  mounted(): void
  beforeUpdate(vnode: VNode): void
  updated(vnode: VNode): void
  beforeUnmount(): void
  unmounted(): void
  errorCaptured(): (
    err: Error,
    type: ErrorTypes,
    instance: ComponentInstance | null,
    vnode: VNode
  ) => boolean | void
  activated(): void
  deactivated(): void
  renderTracked(e: DebuggerEvent): void
  renderTriggered(e: DebuggerEvent): void
}

export interface ComponentClass extends ComponentClassOptions {
  options?: ComponentOptions
  new <P = {}, D = {}>(): Component<P, D> & D & P
}

export interface FunctionalComponent<P = {}> {
  (props: P, slots: Slots, attrs: Data, parentVNode: VNode): any
  props?: ComponentPropsOptions<P>
  displayName?: string
}

export type ComponentType = ComponentClass | FunctionalComponent

// Internal type that represents a mounted instance.
// It extends InternalComponent with mounted instance properties.
export interface ComponentInstance<P = {}, D = {}>
  extends InternalComponent,
    Partial<APIMethods<P, D>>,
    Partial<LifecycleMethods> {
  constructor: ComponentClass
  render: APIMethods<P, D>['render']

  $vnode: MountedVNode
  $data: D
  $props: P
  $attrs: Data
  $slots: Slots
  $root: ComponentInstance
  $children: ComponentInstance[]
  $options: ComponentOptions<P, D>

  _update: ReactiveEffect
  _queueJob: ((fn: () => void) => void)
  _self: ComponentInstance<P, D> // on proxies only
}

// actual implementation of the component
class InternalComponent implements PublicInstanceMethods {
  get $el(): any {
    const el = this.$vnode && this.$vnode.el
    return typeof el === 'function' ? (el as any)() : el
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
  $options: ComponentOptions | null = null
  $refs: Record<string, ComponentInstance | RenderNode> = {}
  $proxy: any = null

  _rawData: Data | null = null
  _computedGetters: Record<string, ComputedGetter> | null = null
  _watchHandles: Set<ReactiveEffect> | null = null
  _mounted: boolean = false
  _unmounted: boolean = false
  _events: { [event: string]: Function[] | null } | null = null
  _update: ReactiveEffect | null = null
  _queueJob: ((fn: () => void) => void) | null = null
  _isVue: boolean = true
  _inactiveRoot: boolean = false
  _hookProps: any = null

  constructor(props?: object) {
    if (props === void 0) {
      initializeComponentInstance(this as any)
    } else {
      // the presence of the props argument indicates that this class is being
      // instantiated as a mixin, and should expose the props on itself
      // so that the extended class constructor (and property initializers) can
      // access $props.
      this.$props = props
    }
    if (__COMPAT__) {
      ;(this as any)._eventEmitter = new EventEmitter(this)
    }
  }

  // necessary to tell this apart from a functional
  render(...args: any[]): any {
    if (__DEV__) {
      const name =
        (this.$options && this.$options.displayName) || this.constructor.name
      warn(`Class component \`${name}\` is missing render() method.`)
    }
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

  $emit(name: string, ...payload: any[]) {
    const parentData =
      (this.$parentVNode && this.$parentVNode.data) || EMPTY_OBJ
    const parentListener =
      parentData['on' + name] || parentData['on' + name.toLowerCase()]
    if (parentListener) {
      invokeListeners(parentListener, payload)
    }
  }
}

// legacy event emitter interface exposed on component instances
if (__COMPAT__) {
  const p = InternalComponent.prototype as any
  ;['on', 'off', 'once'].forEach(key => {
    p['$' + key] = function(...args: any[]) {
      this._eventEmitter[key](...args)
      return this
    }
  })
  const emit = p.$emit
  p.$emit = function(...args: any[]) {
    emit.call(this, ...args)
    this._eventEmitter.emit(...args)
    return this
  }
}

// the exported Component has the implementation details of the actual
// InternalComponent class but with proper type inference of ComponentClass.
export const Component = InternalComponent as ComponentClass
