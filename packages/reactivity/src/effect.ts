import { TrackOpTypes, TriggerOpTypes } from './operations'
import { EMPTY_OBJ, isArray, isIntegerKey, isMap } from '@vue/shared'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
type Dep = Set<ReactiveEffect>
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export interface ReactiveEffect<T = any> {
  (): T
  _isEffect: true
  id: number
  active: boolean
  raw: () => T
  /** 存放 raw 中，每个属性的依赖集合 */
  deps: Array<Dep>
  options: ReactiveEffectOptions
  allowRecurse: boolean
}

export interface ReactiveEffct<T = any> {
  (): T
  _isEffect: true
  id: number
  active: boolean
  raw: () => T
  deps: Array<Dep>
}

export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: (job: ReactiveEffect) => void
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
  onStop?: () => void
  allowRecurse?: boolean
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

// 防止多次触发
const effectStack: ReactiveEffect[] = []
// 用于标记是依赖收集的时候触发的 track
let activeEffect: ReactiveEffect | undefined

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

export function isEffect(fn: any): fn is ReactiveEffect {
  return fn && fn._isEffect === true
}

/** 触发 get handler 函数，进行依赖收集 */
export function effect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions = EMPTY_OBJ
): ReactiveEffect<T> {
  if (isEffect(fn)) {
    fn = fn.raw
  }
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    effect()
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

function createReactiveEffect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions
): ReactiveEffect<T> {
  // 一个 effect 对应一个 reactiveEffect
  const effect = function reactiveEffect(): unknown {
    if (!effect.active) {
      return options.scheduler ? undefined : fn()
    }
    // 防止在当前 effect 中有出发了 trigger，导致递归
    if (!effectStack.includes(effect)) {
      cleanup(effect)
      try {
        enableTracking()
        effectStack.push(effect)
        activeEffect = effect
        /**
         * 我们使用 effect 收集依赖的时候，第一个参数是一个函数：
         * eg： effect(() => (dummy = counter.num))
         * 此时执行 fn(), 就会触发 Proxy 的 get handler函数，从而触发 track 函数
         */
        return fn()
      } finally {
        effectStack.pop()
        resetTracking()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  } as ReactiveEffect
  effect.id = uid++
  effect.allowRecurse = !!options.allowRecurse
  effect._isEffect = true
  effect.active = true
  effect.raw = fn
  effect.deps = []
  effect.options = options
  return effect
}

// 解除捆绑关系
function cleanup(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      // 去除key的订阅者effect
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

let shouldTrack = true
// 用于记录上一个shouldTrack的状态
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

/**
 * 向 target->key->dep 中添加 activeEffect
 * 该函数只有是 effect 触发的get handler才会进行依赖收集
 * 普通的 get 不会收集依赖，是通过 activeEffect 和 shouldTrack 来控制
 */
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  // key->Set<reactiveEffect>
  let depsMap = targetMap.get(target)
  // 如果当前对象没有依赖，则向
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    // 互相依赖
    dep.add(activeEffect)
    // 将 dep 整体加入进去的好处是：cleanup 的时候，可以删除当前 activeEffect
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

/** 触发 key 中的所有 deps */
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
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  }

  effects.forEach(run)
}
