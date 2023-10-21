import { extend, getGlobalThis } from '@vue/shared'
import type { ComputedRefImpl } from './computed'
import { DirtyLevels, TrackOpTypes, TriggerOpTypes } from './constants'
import type { Dep, TrackToken } from './dep'
import { EffectScope, recordEffectScope } from './effectScope'

export type EffectScheduler = (...args: any[]) => any

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

const _FinalizationRegistry = getGlobalThis().FinalizationRegistry as
  | typeof FinalizationRegistry
  | undefined

if (!_FinalizationRegistry && __DEV__) {
  console.warn(`FinalizationRegistry is not available in this environment.`)
}

const registry = _FinalizationRegistry
  ? new _FinalizationRegistry<WeakRef<ReactiveEffect>>(trackToken => {
      const deps = depsMap.get(trackToken)
      if (deps) {
        for (const dep of deps) {
          dep.delete(trackToken)
          if (dep.size === 0) {
            dep.cleanup()
          }
        }
        deps.length = 0
      }
    })
  : undefined

let _WeakRef = getGlobalThis().WeakRef as typeof WeakRef | undefined

if (!_WeakRef && __DEV__) {
  console.warn(`WeakRef is not available in this environment.`)
}

export const depsMap = new WeakMap<TrackToken, Dep[]>()

export class ReactiveEffect<T = any> {
  active = true

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

  _dirtyLevel = DirtyLevels.Dirty
  _trackToken?: TrackToken
  _trackId = 0
  _runnings = 0
  _queryings = 0
  _depsLength = 0

  constructor(
    public fn: () => T,
    public trigger: () => void,
    public scheduler?: EffectScheduler,
    scope?: EffectScope
  ) {
    recordEffectScope(this, scope)
  }

  public get dirty() {
    if (this._dirtyLevel === DirtyLevels.ComputedValueMaybeDirty) {
      this._dirtyLevel = DirtyLevels.NotDirty
      if (this._trackToken) {
        const deps = depsMap.get(this._trackToken)
        if (deps) {
          this._queryings++
          pauseTracking()
          for (const dep of deps) {
            if (dep.computed) {
              triggerComputed(dep.computed)
              if (this._dirtyLevel >= DirtyLevels.ComputedValueDirty) {
                break
              }
            }
          }
          resetTracking()
          this._queryings--
        }
      }
    }
    return this._dirtyLevel >= DirtyLevels.ComputedValueDirty
  }

  public set dirty(v) {
    this._dirtyLevel = v ? DirtyLevels.Dirty : DirtyLevels.NotDirty
  }

  run() {
    this._dirtyLevel = DirtyLevels.NotDirty
    if (!this.active) {
      return this.fn()
    }
    let lastShouldTrack = shouldTrack
    let lastEffect = activeEffect
    try {
      shouldTrack = true
      activeEffect = this
      this._runnings++
      preCleanupEffect(this)
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
      preCleanupEffect(this)
      postCleanupEffect(this)
      this.onStop?.()
      this.active = false
    }
  }

  deref() {
    return this
  }
}

function triggerComputed(computed: ComputedRefImpl<any>) {
  return computed.value
}

function preCleanupEffect(effect: ReactiveEffect) {
  effect._trackId++
  effect._depsLength = 0
}

function postCleanupEffect(effect: ReactiveEffect) {
  if (effect._trackToken) {
    const deps = depsMap.get(effect._trackToken)
    if (deps && deps.length > effect._depsLength) {
      for (let i = effect._depsLength; i < deps.length; i++) {
        cleanupDepEffect(deps[i], effect)
      }
      deps.length = effect._depsLength
    }
  }
}

function cleanupDepEffect(dep: Dep, effect: ReactiveEffect) {
  if (effect._trackToken) {
    const trackId = dep.get(effect._trackToken)
    if (trackId !== undefined && effect._trackId !== trackId) {
      dep.delete(effect._trackToken)
      if (dep.size === 0) {
        dep.cleanup()
      }
    }
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

  const _effect = new ReactiveEffect(
    fn,
    () => {},
    () => {
      if (_effect.dirty) {
        _effect.run()
      }
    }
  )
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
export let pauseScheduleStack = 0

const trackStack: boolean[] = []

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

export function pauseScheduling() {
  pauseScheduleStack++
}

export function resetScheduling() {
  pauseScheduleStack--
  while (!pauseScheduleStack && queueEffectSchedulers.length) {
    queueEffectSchedulers.shift()!()
  }
}

export function trackEffect(
  effect: ReactiveEffect,
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  if (!effect._trackToken) {
    if (effect.scheduler || !_WeakRef) {
      effect._trackToken = effect
    } else {
      effect._trackToken = new _WeakRef(effect)
      registry?.register(effect, effect._trackToken, effect)
    }
  }
  const trackToken = effect._trackToken!
  if (dep.get(trackToken) !== effect._trackId) {
    dep.set(trackToken, effect._trackId)
    let deps = depsMap.get(trackToken)
    if (!deps) {
      depsMap.set(trackToken, (deps = []))
    }
    const oldDep = deps[effect._depsLength]
    if (oldDep !== dep) {
      if (oldDep) {
        cleanupDepEffect(oldDep, effect)
      }
      deps[effect._depsLength++] = dep
    } else {
      effect._depsLength++
    }
    if (__DEV__) {
      effect.onTrack?.(extend({ effect }, debuggerEventExtraInfo!))
    }
  }
}

const queueEffectSchedulers: (() => void)[] = []

export function triggerEffects(
  dep: Dep,
  dirtyLevel: DirtyLevels,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  pauseScheduling()
  for (const trackToken of dep.keys()) {
    const effect = trackToken.deref()
    if (!effect) {
      continue
    }
    if (!effect.allowRecurse && effect._runnings) {
      continue
    }
    if (
      effect._dirtyLevel < dirtyLevel &&
      (!effect._runnings || dirtyLevel !== DirtyLevels.ComputedValueDirty)
    ) {
      const lastDirtyLevel = effect._dirtyLevel
      effect._dirtyLevel = dirtyLevel
      if (
        lastDirtyLevel === DirtyLevels.NotDirty &&
        (!effect._queryings || dirtyLevel !== DirtyLevels.ComputedValueDirty)
      ) {
        if (__DEV__) {
          effect.onTrigger?.(extend({ effect }, debuggerEventExtraInfo))
        }
        effect.trigger()
        if (effect.scheduler) {
          queueEffectSchedulers.push(effect.scheduler)
        }
      }
    }
  }
  resetScheduling()
}
