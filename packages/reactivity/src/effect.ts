import { NOOP, extend } from '@vue/shared'
import type { ComputedRefImpl } from './computed'
import {
  DirtyLevels,
  type TrackOpTypes,
  type TriggerOpTypes,
} from './constants'
import type { Dep } from './dep'
import { type EffectScope, recordEffectScope } from './effectScope'

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

/**
 * `ReactiveEffect`类用于创建响应式效果。
 * 它封装了Effect的逻辑，包括依赖收集、调度执行和停止等操作。
 *
 * @param T 返回值的类型。
 */
export class ReactiveEffect<T = any> {
  active = true // 是否活跃
  deps: Dep[] = [] // 依赖数组

  /**
   * 可在创建后附加的计算属性。Can be attached after creation
   * @internal
   */
  computed?: ComputedRefImpl<T>
  /**
   * 是否允许递归触发。
   * @internal
   */
  allowRecurse?: boolean

  onStop?: () => void // 停止时的回调函数
  //   // 仅开发环境使用的调试回调 dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void

  /**
   * 脏状态级别
   * @internal
   */
  _dirtyLevel = DirtyLevels.Dirty
  /**
   * 跟踪ID
   * @internal
   */
  _trackId = 0
  /**
   * 正在运行的次数。
   * @internal
   */
  _runnings = 0
  /**
   * 是否应该调度。
   * @internal
   */
  _shouldSchedule = false
  /**
   * 依赖数组的长度。
   * @internal
   */
  _depsLength = 0

  /**
   * 构造函数。
   *
   * @param fn 执行的函数。
   * @param trigger 触发更新的函数。
   * @param scheduler 调度器，可选。
   * @param scope 效果作用域，可选。
   */
  constructor(
    public fn: () => T,
    public trigger: () => void,
    public scheduler?: EffectScheduler,
    scope?: EffectScope,
  ) {
    recordEffectScope(this, scope)
  }

  /**
   * 获取当前效果是否脏。
   *
   * 该方法用于判断是否需要重新运行效果函数。
   *
   * @returns 是否脏。
   */
  public get dirty() {
    if (
      this._dirtyLevel === DirtyLevels.MaybeDirty_ComputedSideEffect ||
      this._dirtyLevel === DirtyLevels.MaybeDirty
    ) {
      this._dirtyLevel = DirtyLevels.QueryingDirty
      pauseTracking()
      for (let i = 0; i < this._depsLength; i++) {
        const dep = this.deps[i]
        if (dep.computed) {
          triggerComputed(dep.computed)
          if (this._dirtyLevel >= DirtyLevels.Dirty) {
            break
          }
        }
      }
      if (this._dirtyLevel === DirtyLevels.QueryingDirty) {
        this._dirtyLevel = DirtyLevels.NotDirty
      }
      resetTracking()
    }
    return this._dirtyLevel >= DirtyLevels.Dirty
  }

  /**
   * 设置当前效果的脏状态。
   *
   * @param v 是否设置为脏状态。
   */
  public set dirty(v) {
    this._dirtyLevel = v ? DirtyLevels.Dirty : DirtyLevels.NotDirty
  }

  /**
   * 执行与跟踪相关的操作。
   * 该函数首先检查当前实例是否处于激活状态，如果不活跃，则直接执行并返回指定的函数。
   * 如果处于活跃状态，则在执行前后执行一系列的预清理和后清理操作，并在执行过程中设置当前的跟踪状态和作用域。
   *
   * @returns 返回执行的函数的返回值。
   */
  run() {
    this._dirtyLevel = DirtyLevels.NotDirty // 设置初始脏度等级为未脏
    // 检查实例是否处于非活跃状态
    if (!this.active) {
      // 如果非活跃，直接执行并返回函数
      return this.fn()
    }
    let lastShouldTrack = shouldTrack // 设置当前状态为跟踪状态
    let lastEffect = activeEffect // 保存当前的作用域
    try {
      shouldTrack = true // 设置当前状态为跟踪状态
      activeEffect = this // 设置当前作用域为当前实例
      this._runnings++ // 增加运行计数
      preCleanupEffect(this) // 执行预清理操作
      return this.fn() // 执行并返回函数
    } finally {
      postCleanupEffect(this) // 执行后清理操作
      this._runnings-- // 减少运行计数
      activeEffect = lastEffect // 恢复之前的作用域
      shouldTrack = lastShouldTrack // 恢复之前的跟踪状态
    }
  }

  /**
   * 停止效果。
   *
   * 清理效果，包括调用`onStop`回调，并将活跃状态设置为`false`。
   */
  stop() {
    if (this.active) {
      preCleanupEffect(this)
      postCleanupEffect(this)
      this.onStop && this.onStop()
      this.active = false
    }
  }
}

/**
 * 触发计算属性的重新计算，并返回其当前值。
 * @param computed 一个实现了ComputedRefImpl接口的计算属性对象。
 * @returns 返回计算属性的当前值。
 */
function triggerComputed(computed: ComputedRefImpl<any>) {
  return computed.value // 返回计算属性的当前值
}

/**
 * 对给定的响应式效果进行预清理操作。
 * 该函数主要用来更新效应对象的跟踪ID和依赖数组长度。
 * @param effect 要进行预清理的响应式效应对象
 */
function preCleanupEffect(effect: ReactiveEffect) {
  effect._trackId++ // 更新效应的跟踪ID，用于标识效应的调用次数
  effect._depsLength = 0 // 重置效应的依赖数组长度，表示当前没有依赖
}

/**
 * 对响应式效果进行清理工作。
 * @param effect 要进行清理的响应式效果对象。
 * 此函数遍历并清理effect依赖项中新增的部分，将effect的依赖列表长度重置为之前的长度。
 * 无返回值。
 */
function postCleanupEffect(effect: ReactiveEffect) {
  // 如果当前依赖列表长度大于之前的依赖列表长度，说明有新增的依赖需要清理
  if (effect.deps.length > effect._depsLength) {
    // 遍历新增的依赖项，并对每个依赖项执行清理操作
    for (let i = effect._depsLength; i < effect.deps.length; i++) {
      cleanupDepEffect(effect.deps[i], effect)
    }
    // 重置依赖列表长度为之前的长度，移除新增的依赖项
    effect.deps.length = effect._depsLength
  }
}

/**
 * 清理依赖项上的效果。
 * 该函数用于从依赖项中移除指定的效果，并在必要时清理依赖项。
 *
 * @param dep 依赖项对象，存储了效果函数的集合。
 * @param effect 要从依赖项中移除的效果函数。
 */
function cleanupDepEffect(dep: Dep, effect: ReactiveEffect) {
  // 获取效果函数在依赖项中的标识符
  const trackId = dep.get(effect)
  // 如果标识符存在且与效果函数当前的标识符不相同，则从依赖项中移除该效果函数
  if (trackId !== undefined && effect._trackId !== trackId) {
    dep.delete(effect)
    // 如果依赖项为空，则执行清理操作
    if (dep.size === 0) {
      dep.cleanup()
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
 * 创建一个响应式效果函数。
 * Registers the given function to track reactive updates.
 *
 * The given function will be run once immediately. Every time any reactive
 * property that's accessed within it gets updated, the function will run again.
 *
 * @param fn - 执行副作用的函数。The function that will track reactive updates.
 * @param options - 可选的配置对象，包含lazy、scope等选项。 Allows to control the effect's behaviour.
 * @returns 返回一个绑定了执行函数的ReactiveEffectRunner实例。A runner that can be used to control the effect after creation.
 */
export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions,
): ReactiveEffectRunner {
  // 将传入的函数转换为ReactiveEffectRunner实例的函数
  fn = (fn as ReactiveEffectRunner).effect.fn

  // 创建一个新的ReactiveEffect实例
  const _effect = new ReactiveEffect(fn, NOOP, () => {
    // 如果效果标记为dirty，则运行该效果
    if (_effect.dirty) {
      _effect.run()
    }
  })
  // 如果提供了选项，则扩展到_effect实例上
  if (options) {
    extend(_effect, options)
    // 如果定义了作用域，则记录作用域信息
    if (options.scope) recordEffectScope(_effect, options.scope)
  }
  // 如果未指定延迟执行或指定不延迟，则立即执行
  if (!options || !options.lazy) {
    _effect.run()
  }
  // 绑定运行方法并返回
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
}

/**
 * 停止与给定runner关联的效果跟踪。
 * Stops the effect associated with the given runner.
 *
 * @param runner - 与要停止跟踪的效果相关联的runner。 Association with the effect to stop tracking.
 */
export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop()
}

export let shouldTrack = true // 控制是否进行响应式效果跟踪的全局标志
export let pauseScheduleStack = 0 // 用于暂停调度的计数器

const trackStack: boolean[] = [] // 存储跟踪状态的栈，用于暂停和恢复跟踪

/**
 * 暂时暂停跟踪。
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
  trackStack.push(shouldTrack) // 存储当前跟踪状态
  shouldTrack = true // 暂停跟踪
}

/**
 * 重置先前的全局效果跟踪状态。
 * Resets the previous global effect tracking state.
 */
export function resetTracking() {
  const last = trackStack.pop() // 弹出最新存储的跟踪状态
  shouldTrack = last === undefined ? true : last // 根据存储的状态恢复跟踪
}

export function pauseScheduling() {
  pauseScheduleStack++ // 增加暂停调度的计数器
}

/**
 * 重置调度暂停状态，如果可以的话执行排队的调度器。
 */
export function resetScheduling() {
  pauseScheduleStack-- // 减少暂停调度的计数器
  while (!pauseScheduleStack && queueEffectSchedulers.length) {
    queueEffectSchedulers.shift()!() // 如果没有暂停，执行下一个调度器
  }
}

/**
 * 跟踪一个副作用效应（ReactiveEffect），将其与依赖项（Dep）关联起来。
 * 当依赖项发生变化时，这个函数确保副作用会被重新触发。
 *
 * @param effect 要跟踪的副作用效应函数。
 * @param dep 与该效应相关联的依赖项对象。
 * @param debuggerEventExtraInfo 用于调试器事件的额外信息，可选。
 */
export function trackEffect(
  effect: ReactiveEffect,
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo,
) {
  // 如果当前依赖项未与效应关联，则进行关联并更新依赖列表
  if (dep.get(effect) !== effect._trackId) {
    dep.set(effect, effect._trackId)
    const oldDep = effect.deps[effect._depsLength]
    // 如果当前依赖不是最新的，则清理旧的依赖关系，并添加新的依赖
    if (oldDep !== dep) {
      if (oldDep) {
        cleanupDepEffect(oldDep, effect)
      }
      effect.deps[effect._depsLength++] = dep
    } else {
      // 如果依赖已存在，仅更新依赖计数
      effect._depsLength++
    }
    // 开发环境下，触发跟踪事件
    if (__DEV__) {
      // eslint-disable-next-line no-restricted-syntax
      effect.onTrack?.(extend({ effect }, debuggerEventExtraInfo!))
    }
  }
}

// 定义一个名为queueEffectSchedulers的数组，用于存储EffectScheduler类型的对象。
const queueEffectSchedulers: EffectScheduler[] = []

/**
 * 触发指定依赖上的所有效果。
 * @param dep 依赖对象，包含了一系列需要被触发的效果。
 * @param dirtyLevel 污染级别，用于决定哪些效果应该被触发。
 * @param debuggerEventExtraInfo 调试器事件的额外信息，可选参数，用于在开发环境中提供更多的调试信息。
 */
export function triggerEffects(
  dep: Dep,
  dirtyLevel: DirtyLevels,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo,
) {
  // 暂停调度器，以确保在触发效果时不会进行新的调度
  pauseScheduling()
  for (const effect of dep.keys()) {
    // 计算跟踪状态，仅在需要时进行，以提高性能
    // dep.get(effect) is very expensive, we need to calculate it lazily and reuse the result
    let tracking: boolean | undefined
    // 判断是否需要调度该效果，并更新其污染级别
    if (
      effect._dirtyLevel < dirtyLevel &&
      (tracking ??= dep.get(effect) === effect._trackId)
    ) {
      effect._shouldSchedule ||= effect._dirtyLevel === DirtyLevels.NotDirty
      effect._dirtyLevel = dirtyLevel
    }
    // 如果效果被标记为应该调度，并且满足触发条件，则触发该效果
    if (
      effect._shouldSchedule &&
      (tracking ??= dep.get(effect) === effect._trackId)
    ) {
      // 在开发环境中，触发效果前调用onTrigger回调，提供调试信息
      if (__DEV__) {
        // eslint-disable-next-line no-restricted-syntax
        effect.onTrigger?.(extend({ effect }, debuggerEventExtraInfo))
      }
      effect.trigger()
      // 如果效果允许递归或者没有运行中状态，且不是可能污染的计算副作用，则标记不再调度
      if (
        (!effect._runnings || effect.allowRecurse) &&
        effect._dirtyLevel !== DirtyLevels.MaybeDirty_ComputedSideEffect
      ) {
        effect._shouldSchedule = false
        // 如果效果有自己的调度器，则将其加入到调度队列中
        if (effect.scheduler) {
          queueEffectSchedulers.push(effect.scheduler)
        }
      }
    }
  }
  resetScheduling()
}
