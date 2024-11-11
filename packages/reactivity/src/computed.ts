import { isFunction } from '@vue/shared'
import {
  Dependency,
  type DirtyLevels,
  type IComputed,
  type Link,
  Subscriber,
  System,
} from 'alien-signals'
import { ReactiveFlags, TrackOpTypes } from './constants'
import { onTrack, setupDirtyLevelHandler } from './debug'
import type { DebuggerEvent, DebuggerOptions } from './effect'
import type { Ref } from './ref'
import { warn } from './warning'

declare const ComputedRefSymbol: unique symbol
declare const WritableComputedRefSymbol: unique symbol

interface BaseComputedRef<T, S = T> extends Ref<T, S> {
  [ComputedRefSymbol]: true
  /**
   * @deprecated computed no longer uses effect
   */
  effect: ComputedRefImpl
}

export interface ComputedRef<T = any> extends BaseComputedRef<T> {
  readonly value: T
}

export interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
  [WritableComputedRefSymbol]: true
}

export type ComputedGetter<T> = (oldValue?: T) => T
export type ComputedSetter<T> = (newValue: T) => void

export interface WritableComputedOptions<T, S = T> {
  get: ComputedGetter<T>
  set: ComputedSetter<S>
}

let globalVersion = 0
let initSSR = false

/**
 * @private exported by @vue/reactivity for Vue core use, but not exported from
 * the main vue package
 */
export class ComputedRefImpl<T = any> implements IComputed {
  _value: T | undefined = undefined

  // Dependency
  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined

  // Subscriber
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  trackId = 0
  dirtyLevel: DirtyLevels = 3 satisfies DirtyLevels.Dirty
  canPropagate = false

  /**
   * @internal
   */
  readonly __v_isRef = true
  // TODO isolatedDeclarations ReactiveFlags.IS_REF
  /**
   * @internal
   */
  readonly __v_isReadonly: boolean
  // TODO isolatedDeclarations ReactiveFlags.IS_READONLY
  /**
   * @internal
   */
  globalVersion: number = globalVersion - 1
  /**
   * @internal
   */
  isSSR: boolean

  // for backwards compat
  get effect(): this {
    return this
  }
  // for backwards compat
  get dep(): Dependency {
    return this
  }
  // dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void

  /**
   * Dev only
   * @internal
   */
  _warnRecursive?: boolean

  constructor(
    public fn: ComputedGetter<T>,
    private readonly setter: ComputedSetter<T> | undefined,
    isSSR: boolean,
  ) {
    this[ReactiveFlags.IS_READONLY] = !setter
    this.isSSR = isSSR

    if (isSSR && !initSSR) {
      initSSR = true
      const propagate = Dependency.propagate
      Dependency.propagate = (link: Link) => {
        globalVersion++
        propagate(link)
      }
    }
    if (__DEV__) {
      setupDirtyLevelHandler(this)
    }
  }

  get value(): T {
    // In SSR there will be no render effect, so the computed has no subscriber
    // and therefore tracks no deps, thus we cannot rely on the dirty check.
    // Instead, computed always re-evaluate and relies on the globalVersion
    // fast path above for caching.
    if (this.isSSR) {
      if (globalVersion !== this.globalVersion) {
        this.globalVersion = globalVersion
        this.update()
      }
    } else {
      const dirtyLevel = this.dirtyLevel
      if (dirtyLevel === (2 satisfies DirtyLevels.MaybeDirty)) {
        Subscriber.resolveMaybeDirty(this)
        if (this.dirtyLevel === (3 satisfies DirtyLevels.Dirty)) {
          this.update()
        }
      } else if (
        dirtyLevel === (3 satisfies DirtyLevels.Dirty) ||
        dirtyLevel === (4 satisfies DirtyLevels.Released)
      ) {
        this.update()
      }
    }
    const activeTrackId = System.activeTrackId
    if (activeTrackId !== 0) {
      const subsTail = this.subsTail
      if (subsTail === undefined || subsTail.trackId !== activeTrackId) {
        if (__DEV__) {
          onTrack(System.activeSub!, {
            target: this,
            type: TrackOpTypes.GET,
            key: 'value',
          })
        }
        Dependency.link(this, System.activeSub!)
      }
    }
    return this._value!
  }

  set value(newValue) {
    if (this.setter) {
      this.setter(newValue)
    } else if (__DEV__) {
      warn('Write operation failed: computed value is readonly')
    }
  }

  update(): void {
    const prevSub = Subscriber.startTrack(this)
    const oldValue = this._value
    let newValue: T
    try {
      newValue = this.fn(oldValue)
    } finally {
      Subscriber.endTrack(this, prevSub)
    }
    if (oldValue !== newValue) {
      this._value = newValue
      const subs = this.subs
      if (subs !== undefined) {
        Dependency.propagate(subs)
      }
    }
  }
}

/**
 * Takes a getter function and returns a readonly reactive ref object for the
 * returned value from the getter. It can also take an object with get and set
 * functions to create a writable ref object.
 *
 * @example
 * ```js
 * // Creating a readonly computed ref:
 * const count = ref(1)
 * const plusOne = computed(() => count.value + 1)
 *
 * console.log(plusOne.value) // 2
 * plusOne.value++ // error
 * ```
 *
 * ```js
 * // Creating a writable computed ref:
 * const count = ref(1)
 * const plusOne = computed({
 *   get: () => count.value + 1,
 *   set: (val) => {
 *     count.value = val - 1
 *   }
 * })
 *
 * plusOne.value = 1
 * console.log(count.value) // 0
 * ```
 *
 * @param getter - Function that produces the next value.
 * @param debugOptions - For debugging. See {@link https://vuejs.org/guide/extras/reactivity-in-depth.html#computed-debugging}.
 * @see {@link https://vuejs.org/api/reactivity-core.html#computed}
 */
export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions,
): ComputedRef<T>
export function computed<T, S = T>(
  options: WritableComputedOptions<T, S>,
  debugOptions?: DebuggerOptions,
): WritableComputedRef<T, S>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false,
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T> | undefined

  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  const cRef = new ComputedRefImpl(getter, setter, isSSR)

  if (__DEV__ && debugOptions && !isSSR) {
    cRef.onTrack = debugOptions.onTrack
    cRef.onTrigger = debugOptions.onTrigger
  }

  return cRef as any
}
