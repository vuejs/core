import { DirtyLevels, TrackOpTypes, TriggerOpTypes } from './constants'
import { extend, isArray, isIntegerKey, isMap } from '@vue/shared'
import { EffectScope, recordEffectScope } from './effectScope'
import { createDep, Dep } from './dep'
import type { ComputedRefImpl } from './computed'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<object, KeyToDepMap>()

export type EffectScheduler = (
  onScheduled: (cb: () => void) => void,
  ...args: any[]
) => any

export type DebuggerEvent = {
  effect: ReactiveEffect
} & DebuggerEventExtraInfo

export type DebuggerEventExtraInfo = {
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

export let activeEffect: ReactiveEffect | undefined

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

export class ReactiveEffect<T = any> {
  active = true
  deps: Dep[] = []

  /**
   * Can be attached after creation
   * @internal
   */
  computed?: ComputedRefImpl<T>
  /**
   * @internal
   */
  allowRecurse?: boolean

  onStop?: () => void
  // dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void
  // dev only
  debuggerEventExtraInfo?: DebuggerEventExtraInfo

  _dirtyLevel = DirtyLevels.Dirty
  _queryingDirty = false
  _trackId = 0
  _runnings = 0
  _depsWriteIndex = 0

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler,
    scope?: EffectScope
  ) {
    recordEffectScope(this, scope)
  }

  public get dirty() {
    if (this._dirtyLevel === DirtyLevels.ComputedValueMaybeDirty) {
      this._dirtyLevel = DirtyLevels.NotDirty
      this._queryingDirty = true
      pauseTracking()
      for (const dep of this.deps) {
        dep.queryDirty?.()
        if (this._dirtyLevel >= DirtyLevels.ComputedValueDirty) {
          break
        }
      }
      resetTracking()
      this._queryingDirty = false
    }
    return this._dirtyLevel >= DirtyLevels.ComputedValueDirty
  }

  public set dirty(v) {
    this._dirtyLevel = v ? DirtyLevels.Dirty : DirtyLevels.NotDirty
  }

  run() {
    if (__DEV__ && this.debuggerEventExtraInfo) {
      this.onTrigger?.(extend({ effect: this }, this.debuggerEventExtraInfo))
      this.debuggerEventExtraInfo = undefined
    }
    this._dirtyLevel = DirtyLevels.NotDirty
    const result = this._run()
    if ((this._dirtyLevel as DirtyLevels) === DirtyLevels.ComputedValueDirty) {
      this._dirtyLevel--
    }
    return result
  }

  _run() {
    if (!this.active) {
      return this.fn()
    }
    let lastShouldTrack = shouldTrack
    let lastEffect = activeEffect
    try {
      shouldTrack = true
      activeEffect = this
      this._runnings++
      cleanupEffect(this)
      return this.fn()
    } finally {
      postCleanupEffect(this)
      this._runnings--
      activeEffect = lastEffect
      shouldTrack = lastShouldTrack
    }
  }

  stop() {
    if (this.active) {
      cleanupEffect(this)
      postCleanupEffect(this)
      this.onStop?.()
      this.active = false
    }
  }
}

function cleanupEffect(effect: ReactiveEffect) {
  effect._trackId++
  effect._depsWriteIndex = 0
}

function postCleanupEffect(effect: ReactiveEffect) {
  if (effect.deps.length > effect._depsWriteIndex) {
    effect.deps.length = effect._depsWriteIndex
  }
}

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}

export interface ReactiveEffectOptions extends DebuggerOptions {
  lazy?: boolean
  scheduler?: EffectScheduler
  scope?: EffectScope
  allowRecurse?: boolean
  onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

/**
 * Registers the given function to track reactive updates.
 *
 * The given function will be run once immediately. Every time any reactive
 * property that's accessed within it gets updated, the function will run again.
 *
 * @param fn - The function that will track reactive updates.
 * @param options - Allows to control the effect's behaviour.
 * @returns A runner that can be used to control the effect after creation.
 */
export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const _effect = new ReactiveEffect(fn, onScheduled => {
    onScheduled(() => {
      if (_effect.dirty) {
        _effect.run()
      }
    })
  })
  if (options) {
    extend(_effect, options)
    if (options.scope) recordEffectScope(_effect, options.scope)
  }
  if (!options || !options.lazy) {
    _effect.run()
  }
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
}

/**
 * Stops the effect associated with the given runner.
 *
 * @param runner - Association with the effect to stop tracking.
 */
export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop()
}

export let shouldTrack = true
export let shouldSchedule = true

const trackStack: boolean[] = []
const scheduleStack: boolean[] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

/**
 * Re-enables effect tracking (if it was paused).
 */
export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

/**
 * Resets the previous global effect tracking state.
 */
export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

/**
 * @internal
 */
export function pauseScheduling() {
  scheduleStack.push(shouldSchedule)
  shouldSchedule = false
}

/**
 * @internal
 */
export function resetScheduling() {
  const last = scheduleStack.pop()
  shouldSchedule = last === undefined ? true : last
  while (shouldSchedule && queueEffectCbs.length) {
    queueEffectCbs.shift()!()
  }
}

/**
 * Tracks access to a reactive property.
 *
 * This will check which effect is running at the moment and record it as dep
 * which records all effects that depend on the reactive property.
 *
 * @param target - Object holding the reactive property.
 * @param type - Defines the type of access to the reactive property.
 * @param key - Identifier of the reactive property to track.
 */
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }
    if (__DEV__) {
      trackEffect(activeEffect, dep, {
        target,
        type,
        key
      })
    } else {
      trackEffect(activeEffect, dep)
    }
  }
}

export function trackEffect(
  effect: ReactiveEffect,
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  if (dep.get(effect) !== effect._trackId) {
    dep.set(effect, effect._trackId)
    effect.deps[effect._depsWriteIndex++] = dep
    if (__DEV__) {
      effect.onTrack?.(extend({ effect }, debuggerEventExtraInfo!))
    }
  }
}

/**
 * Finds all deps associated with the target (or a specific property) and
 * triggers the effects stored within.
 *
 * @param target - The reactive object.
 * @param type - Defines the type of the operation that needs to trigger effects.
 * @param key - Can be used to target a specific reactive property in the target object.
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    return
  }

  let deps: (Dep | undefined)[] = []
  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    deps = [...depsMap.values()]
  } else if (key === 'length' && isArray(target)) {
    const newLength = Number(newValue)
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= newLength) {
        deps.push(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          deps.push(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  pauseScheduling()
  for (const dep of deps) {
    if (dep) {
      if (__DEV__) {
        triggerEffects(dep, DirtyLevels.Dirty, {
          target,
          type,
          key,
          newValue,
          oldValue,
          oldTarget
        })
      } else {
        triggerEffects(dep, DirtyLevels.Dirty)
      }
    }
  }
  resetScheduling()
}

const queueEffectCbs: (() => void)[] = []
const pushEffectCb = queueEffectCbs.push.bind(queueEffectCbs)

export function triggerEffects(
  dep: Dep,
  dirtyLevel: DirtyLevels,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  let invalidEffects: ReactiveEffect[] | undefined

  pauseScheduling()
  for (const [effect, trackId] of dep) {
    if (effect._trackId !== trackId) {
      invalidEffects ??= []
      invalidEffects.push(effect)
      continue
    }
    if (!effect.allowRecurse && effect._runnings) {
      continue
    }
    if (effect._dirtyLevel < dirtyLevel) {
      effect._dirtyLevel = dirtyLevel
      if (
        dirtyLevel === DirtyLevels.ComputedValueMaybeDirty ||
        dirtyLevel === DirtyLevels.Dirty ||
        (dirtyLevel === DirtyLevels.ComputedValueDirty &&
          !effect._queryingDirty)
      ) {
        if (__DEV__) {
          effect.debuggerEventExtraInfo = debuggerEventExtraInfo
        }
        effect.scheduler(pushEffectCb)
      }
    }
  }
  resetScheduling()

  if (invalidEffects) {
    for (const effect of invalidEffects) {
      dep.delete(effect)
    }
  }
}

export function getDepFromReactive(object: any, key: string | number | symbol) {
  return targetMap.get(object)?.get(key)
}
