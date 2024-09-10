import { isArray, isIntegerKey, isMap, isSymbol } from '@vue/shared'
import { DirtyLevels, type TrackOpTypes, TriggerOpTypes } from './constants'
import { type Dep, createDep } from './dep'
import {
  activeEffect,
  pauseScheduling,
  resetScheduling,
  shouldTrack,
  trackEffect,
  triggerEffects,
} from './effect'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Maps to reduce memory overhead.
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<object, KeyToDepMap>()

/**
 * 定义一个全局的迭代器符号。
 * 如果处于开发环境(__DEV__为true)，则符号名称为iterate
 * 否则，符号名称为空字符串。
 * @type {Symbol}
 */
export const ITERATE_KEY: Symbol = Symbol(__DEV__ ? 'iterate' : '')

/**
 * 定义一个用于Map键迭代的全局符号。
 * 如果处于开发环境(__DEV__为true)，则符号名称为'Map key iterate'；
 * 否则，符号名称为空字符串。
 * @type {Symbol}
 */
export const MAP_KEY_ITERATE_KEY: Symbol = Symbol(
  __DEV__ ? 'Map key iterate' : '',
)

/**
 * 跟踪目标对象的属性变化，将其与当前活动的响应式效果关联起来。
 * Tracks access to a reactive property.
 *
 * This will check which effect is running at the moment and record it as dep
 * which records all effects that depend on the reactive property.
 *
 * @param target - 被跟踪的对象 Object holding the reactive property.
 * @param type - 跟踪操作的类型（例如：赋值操作）Defines the type of access to the reactive property.
 * @param key - 对象属性的键 Identifier of the reactive property to track.
 */
export function track(target: object, type: TrackOpTypes, key: unknown) {
  // 当需要跟踪且存在活跃的effect时执行跟踪逻辑
  if (shouldTrack && activeEffect) {
    // 尝试获取目标对象的依赖映射，如果不存在则创建
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    // 尝试获取属性键对应的依赖集合，如果不存在则创建
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep(() => depsMap!.delete(key))))
    }
    // 为当前活跃的effect记录依赖
    trackEffect(
      activeEffect,
      dep,
      __DEV__ // 开发环境附加调试信息，生产环境则不附加
        ? {
            target,
            type,
            key,
          }
        : void 0,
    )
  }
}

/**
 * 触发目标对象上与指定操作类型相关的依赖效果。
 * Finds all deps associated with the target (or a specific property) and
 * triggers the effects stored within.
 *
 * @param target - 目标对象，触发操作的对象。The reactive object.
 * @param type - 操作类型，决定如何触发依赖效果。Defines the type of the operation that needs to trigger effects.
 * @param key - 关联的键，针对SET、ADD或DELETE操作时指定受影响的键。Can be used to target a specific reactive property in the target object.
 * @param newValue - 对于SET、ADD或DELETE操作时指定新值。Can be used to target a specific
 * @param oldValue - 对于SET、ADD或DELETE操作时指定旧值。Can be used to target a
 * @param oldTarget - 对于SET、ADD或DELETE操作时指定旧目标对象。Can be used to target
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>,
) {
  // 尝试获取目标对象的依赖映射
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // 如果目标对象从未被跟踪，则直接返回
    // never been tracked
    return
  }

  let deps: (Dep | undefined)[] = []
  if (type === TriggerOpTypes.CLEAR) {
    // 如果是清除操作，触发目标上所有依赖的效果
    // collection being cleared
    // trigger all effects for target
    deps = [...depsMap.values()]
  } else if (key === 'length' && isArray(target)) {
    // 如果操作针对数组的长度，并且有新旧长度值，触发受影响的依赖
    const newLength = Number(newValue)
    depsMap.forEach((dep, key) => {
      if (key === 'length' || (!isSymbol(key) && key >= newLength)) {
        deps.push(dep)
      }
    })
  } else {
    // 针对SET、ADD或DELETE操作，调度并触发相关依赖
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }

    // 根据不同的操作类型，可能需要额外触发迭代键相关的依赖
    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          // 对于数组增加操作，可能需要触发长度依赖
          // new index added to array -> length changes
          deps.push(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            // 对于Map对象的设置操作，可能需要触发迭代键依赖
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

  // 暂停调度，确保依赖更新时不被中断
  pauseScheduling()
  for (const dep of deps) {
    if (dep) {
      // 触发每个依赖的效果
      triggerEffects(
        dep,
        DirtyLevels.Dirty,
        __DEV__
          ? {
              target,
              type,
              key,
              newValue,
              oldValue,
              oldTarget,
            }
          : void 0,
      )
    }
  }
  // 重置调度状态，允许后续操作继续
  resetScheduling()
}

export function getDepFromReactive(object: any, key: PropertyKey) {
  const depsMap = targetMap.get(object)
  return depsMap && depsMap.get(key)
}
