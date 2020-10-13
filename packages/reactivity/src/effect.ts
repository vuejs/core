import { TrackOpTypes, TriggerOpTypes } from './operations'
import { EMPTY_OBJ, isArray, isIntegerKey, isMap } from '@vue/shared'
import { toRaw } from './reactive'

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

type EffectScheduler = (job: () => void) => void

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
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
} & DebuggerEventExtraInfo

export interface DebuggerEventExtraInfo {
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
  if (!shouldTrack || activeEffect === undefined) {
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
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
    if (__DEV__ && activeEffect.options.onTrack) {
      activeEffect.options.onTrack({
        effect: activeEffect,
        target,
        type,
        key
      })
    }
  }
}

export function trackRefTarget(ref: any) {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }

  ref = toRaw(ref)

  if (!ref.dep) {
    ref.dep = new Set<ReactiveEffect>()
  }

  const dep = ref.dep
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
    if (__DEV__ && activeEffect.options.onTrack) {
      activeEffect.options.onTrack({
        effect: activeEffect,
        target: ref,
        type: TrackOpTypes.GET,
        key: 'value'
      })
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

  const effects = new Set<ReactiveEffect>()
  const add = (effectsToAdd: Set<ReactiveEffect> | undefined) => {
    if (effectsToAdd) {
      effectsToAdd.forEach(effect => {
        if (effect !== activeEffect || effect.allowRecurse) {
          effects.add(effect)
        }
      })
    }
  }

  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    depsMap.forEach(add)
  } else if (key === 'length' && isArray(target)) {
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= (newValue as number)) {
        add(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      add(depsMap.get(key))
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          add(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          add(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  const run = (effect: ReactiveEffect) => {
    if (__DEV__ && effect.options.onTrigger) {
      effect.options.onTrigger({
        effect,
        target,
        key,
        type,
        newValue,
        oldValue,
        oldTarget
      })
    }
    if (effect.scheduler) {
      effect.scheduler(effect.func)
    } else {
      effect.run()
    }
  }

  effects.forEach(run)
}

export function triggerRefTarget(
  ref: any,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  ref = toRaw(ref)

  if (!ref.dep) {
    return
  }

  const run = (effect: ReactiveEffect) => {
    if (__DEV__ && effect.options.onTrigger) {
      effect.options.onTrigger({
        effect,
        target: ref,
        key: 'value',
        type: TriggerOpTypes.SET,
        newValue,
        oldValue,
        oldTarget
      })
    }
    if (effect.scheduler) {
      effect.scheduler(effect.func)
    } else {
      effect.run()
    }
  }

  const immutableDeps = [...ref.dep]
  immutableDeps.forEach(effect => {
    if (effect !== activeEffect || effect.allowRecurse) {
      run(effect)
    }
  })
}
