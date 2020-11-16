import { TrackOpTypes, TriggerOpTypes } from './operations'
import { EMPTY_OBJ, isArray, isIntegerKey, isMap } from '@vue/shared'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
//
// Notice that refs store their deps in a local property for
// performance reasons.
type Dep = Set<ReactiveEffect>
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export type EffectScheduler = (job: () => void) => void

export class ReactiveEffect<T = any> {
  public id = uid++
  public deps: Dep[] = []
  private runner?: ReactiveEffectFunction<T>

  constructor(
    public raw: () => T,
    allowRecurse: boolean,
    public scheduler: EffectScheduler | undefined,
    options: ReactiveEffectOptions | undefined
  ) {
    if (allowRecurse) {
      this.allowRecurse = true
    }
    if (options) {
      this.options = options
    }
  }

  public setOnStop(func: () => void) {
    if (this.options === EMPTY_OBJ) {
      this.options = {}
    }
    this.options.onStop = func
  }

  public run() {
    if (!this.active) {
      return this.scheduler ? undefined : this.raw()
    }
    if (!effectStack.includes(this)) {
      cleanup(this)
      try {
        enableTracking()
        effectStack.push(this)
        activeEffect = this
        return this.raw()
      } finally {
        effectStack.pop()
        resetTracking()
        const n = effectStack.length
        activeEffect = n ? effectStack[n - 1] : undefined
      }
    }
  }

  public get func(): ReactiveEffectFunction<T> {
    if (!this.runner) {
      const runner = () => {
        return this.run()
      }
      runner.effect = this
      runner.allowRecurse = this.allowRecurse
      this.runner = runner
    }
    return this.runner
  }
}

// Use prototype for optional properties to minimize memory usage.
export interface ReactiveEffect {
  active: boolean
  allowRecurse: boolean
  options: ReactiveEffectOptions
}

ReactiveEffect.prototype.active = true
ReactiveEffect.prototype.allowRecurse = false
ReactiveEffect.prototype.options = EMPTY_OBJ

export interface ReactiveEffectFunction<T = any> {
  (): T | undefined
  effect: ReactiveEffect<T>
  allowRecurse: boolean
}

function createReactiveEffect<T = any>(
  fn: () => T,
  allowRecurse: boolean,
  scheduler: EffectScheduler | undefined,
  options: ReactiveEffectOptions | undefined
): ReactiveEffect<T> {
  return new ReactiveEffect(fn, allowRecurse, scheduler, options)
}

export interface ReactiveEffectOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
  onStop?: () => void
}

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

const effectStack: ReactiveEffect[] = []
let activeEffect: ReactiveEffect | undefined

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

export function isEffect(fn: any): fn is ReactiveEffectFunction {
  return fn && !!fn.effect
}

export function effect<T = any>(
  fn: () => T,
  scheduler: EffectScheduler | undefined = undefined,
  allowRecurse: boolean = false,
  lazy: boolean = false,
  options: ReactiveEffectOptions | undefined = undefined
): ReactiveEffect<T> {
  if (isEffect(fn)) {
    fn = fn.effect.raw
  }
  const effect = createReactiveEffect(fn, allowRecurse, scheduler, options)

  if (!lazy) {
    effect.run()
  }
  return effect
}

export function stop(effect: ReactiveEffect) {
  if (effect.active) {
    cleanup(effect)
    if (effect.options.onStop) {
      effect.options.onStop()
    }
    effect.active = false
  }
}

let uid = 0

function cleanup(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

let shouldTrack = true
const trackStack: boolean[] = []

export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (!isTracking()) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  const eventInfo = __DEV__
    ? { effect: activeEffect, target, type, key }
    : undefined

  trackEffects(dep, eventInfo)
}

export function isTracking() {
  return shouldTrack && activeEffect !== undefined
}

export function trackEffects(
  dep: Set<ReactiveEffect>,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  const effect = activeEffect!
  if (!dep.has(effect)) {
    dep.add(effect)
    effect.deps.push(dep)
    if (__DEV__ && effect.options.onTrack) {
      effect.options.onTrack(Object.assign({ effect }, debuggerEventExtraInfo))
    }
  }
}

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

  let sets: DepSets = []
  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    sets = [...depsMap.values()]
  } else if (key === 'length' && isArray(target)) {
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= (newValue as number)) {
        sets.push(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      sets.push(depsMap.get(key))
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          sets.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            sets.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          sets.push(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          sets.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            sets.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          sets.push(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  const eventInfo = __DEV__
    ? { target, type, key, newValue, oldValue, oldTarget }
    : undefined
  triggerMultiEffects(sets, eventInfo)
}

type DepSets = (Dep | undefined)[]

export function triggerMultiEffects(
  depSets: DepSets,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  const sets = depSets.filter(set => !!set) as Dep[]
  if (sets.length > 1) {
    triggerEffects(concatSets(sets), debuggerEventExtraInfo)
  } else if (sets.length === 1) {
    triggerEffects(sets[0], debuggerEventExtraInfo)
  }
}

function concatSets<T>(sets: Set<T>[]): Set<T> {
  const all = ([] as T[]).concat(...sets.map(s => [...s!]))
  const deduped = new Set(all)
  return deduped
}

export function triggerEffects(
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  const run = (effect: ReactiveEffect) => {
    if (__DEV__ && effect.options.onTrigger) {
      effect.options.onTrigger(
        Object.assign({ effect }, debuggerEventExtraInfo)
      )
    }
    if (effect.scheduler) {
      effect.scheduler(effect.func)
    } else {
      effect.run()
    }
  }

  const immutableDeps = [...dep]
  immutableDeps.forEach(effect => {
    if (effect !== activeEffect || effect.allowRecurse) {
      run(effect)
    }
  })
}
