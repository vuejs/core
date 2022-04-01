import { TrackOpTypes, TriggerOpTypes } from './operations'
import { extend, isArray, isIntegerKey, isMap } from '@vue/shared'
import { EffectScope, recordEffectScope } from './effectScope'
import {
  createDep,
  Dep,
  finalizeDepMarkers,
  initDepMarkers,
  newTracked,
  wasTracked
} from './dep'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

// The number of effects currently being tracked recursively.
let effectTrackDepth = 0

export let trackOpBit = 1

/**
 * The bitwise track markers support at most 30 levels op recursion.
 * This value is chosen to enable modern JS engines to use a SMI on all platforms.
 * When recursion depth is greater, fall back to using a full cleanup.
 */

// 声明最深30层递归达到js引擎极致
const maxMarkerBits = 30

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

// effect栈，用于存储effect
const effectStack: ReactiveEffect[] = []
let activeEffect: ReactiveEffect | undefined // 指向当前effect

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

export class ReactiveEffect<T = any> {
  active = true
  deps: Dep[] = []

  // can be attached after creation
  computed?: boolean
  allowRecurse?: boolean
  onStop?: () => void
  // dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void

  constructor(
    public fn: () => T,
    // public声明了全局可以通过this.scheduler访问
    public scheduler: EffectScheduler | null = null,
    scope?: EffectScope | null
  ) {
    recordEffectScope(this, scope) // 收集当前内部的所有effect
  }

  run() {
    // effects栈已经被stop清空了
    if (!this.active) {
      // 判断当前已经被收集过了，可以直接触发回调函数
      return this.fn()
    }
    // 判断当前effect栈中是没有存在当前effect
    if (!effectStack.includes(this)) {
      try {
        effectStack.push((activeEffect = this)) // 在effect栈中加入当前effect，并且将当前effect设为活跃effect
        enableTracking()

        trackOpBit = 1 << ++effectTrackDepth

          // 最大栈内存
        if (effectTrackDepth <= maxMarkerBits) {
          // 对dep进行标志
          initDepMarkers(this)
        } else {
          // 删除当前effect的dep
          cleanupEffect(this)
        }
        return this.fn()
      } finally {
        if (effectTrackDepth <= maxMarkerBits) {
          // 删除掉标志
          finalizeDepMarkers(this)
        }

        trackOpBit = 1 << --effectTrackDepth

        resetTracking()
        // 删除栈顶的effect
        effectStack.pop()
        const n = effectStack.length
        // 将活跃effect设置栈顶那个
        activeEffect = n > 0 ? effectStack[n - 1] : undefined
      }
    }
  }

  stop() {
    if (this.active) {
      // 删除当前effect的dep
      cleanupEffect(this)
      if (this.onStop) {
        this.onStop()
      }
      this.active = false
    }
  }
}

// 清除effect的deps
function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
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

export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions
): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const _effect = new ReactiveEffect(fn)
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

export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop()
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

// 追踪收集依赖
// 生成指定的数据结构
export function track(target: object, type: TrackOpTypes, key: unknown) {
  // 只有在正有activeEffect状态，才能在执行追踪
  if (!isTracking()) {
    return
  }
  // 依赖的map,将instance当做key存在targetMap里面
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  // 获取target内部的数据
  let dep = depsMap.get(key)
  // 判断当前依赖Map没有收集到key，进行收集
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }
  // 默认数据结构 {target: {key: [w:0,n:0]}}
  // targetMap ==》 depsMap ==》 dep（Set()）
  const eventInfo = __DEV__
    ? { effect: activeEffect, target, type, key } // type只是用于开发环境的说明
    : undefined

  trackEffects(dep, eventInfo)
}

export function isTracking() {
  return shouldTrack && activeEffect !== undefined
}

export function trackEffects(
  dep: Dep, // 依赖值
  debuggerEventExtraInfo?: DebuggerEventExtraInfo // 信息提示,开发环境
) {
  let shouldTrack = false
  // 没有超过最大长度
  if (effectTrackDepth <= maxMarkerBits) {
    // 没有被收集依赖
    if (!newTracked(dep)) {
      dep.n |= trackOpBit // set newly tracked
      // 没有被收集，应该进行收集依赖，true
      shouldTrack = !wasTracked(dep)
    }
  } else {
    // Full cleanup mode.
    // 依赖收集已经满了，判断dep没有当前effect，立即进行收集
    shouldTrack = !dep.has(activeEffect!)
  }

    // 运行收集依赖
  if (shouldTrack) {
    dep.add(activeEffect!)
    // 在活动effect的收集依赖值到deps里面，相互嵌套了
    activeEffect!.deps.push(dep)
    if (__DEV__ && activeEffect!.onTrack) {
      // 开发环境加入报错信息
      activeEffect!.onTrack(
        Object.assign(
          {
            effect: activeEffect!
          },
          debuggerEventExtraInfo
        )
      )
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
  debugger
  // track阶段收集到的依赖
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    // 没有收集到依赖
    return
  }

  let deps: (Dep | undefined)[] = []
  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target

    // 将target下的所有deps拿出来，执行清空
    deps = [...depsMap.values()]
  } else if (key === 'length' && isArray(target)) {
    // 1.通过操作数组长度，将多出来的dep拿出来
    // 2.array1[1,2,3] ==> array1.length = 2 ==> 3就要去掉
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= (newValue as number)) {
        deps.push(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) { // key !== undefined
      // 取出key对应的dep，如果是Add，是没有dep
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

  const eventInfo = __DEV__
    ? { target, type, key, newValue, oldValue, oldTarget }
    : undefined

  if (deps.length === 1) {
    if (deps[0]) {
      if (__DEV__) {
        triggerEffects(deps[0], eventInfo)
      } else {
        triggerEffects(deps[0])
      }
    }
  } else {
    const effects: ReactiveEffect[] = []
    // 拿出所有的依赖项
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    if (__DEV__) {
      triggerEffects(createDep(effects), eventInfo)
    } else {
      triggerEffects(createDep(effects))
    }
  }
}

export function triggerEffects(
  dep: Dep | ReactiveEffect[], // [ReactiveEffect, w, n]
  debuggerEventExtraInfo?: DebuggerEventExtraInfo
) {
  debugger
  // spread into array for stabilization
  for (const effect of isArray(dep) ? dep : [...dep]) {
    // 这里就是触发了effect里面的fn或者scheduler

    // effect == activeEffect 说明当前effect正在触发，不需要重复触发
    if (effect !== activeEffect || effect.allowRecurse) {
      if (__DEV__ && effect.onTrigger) {
        effect.onTrigger(extend({ effect }, debuggerEventExtraInfo))
      }
      if (effect.scheduler) {
        // class里面声明了这个属性
        // ReactiveEffect(scheduler)
        effect.scheduler()
      } else {
        effect.run()
      }
    }
  }
}
