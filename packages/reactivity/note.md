总体：

````js
const a = ```reactive```({ a1: 'a1', a2: 'a2' })
const b = reactive({ b1: 'b1', b2: 'b2' })

watchEffect(()=>{
    const a
})
````

# 前提知识

响应式的思想是：`订阅者-发布者` 的设计模式

当我们修改某个属性时，这个属性的所有依赖着都会立即执行，这个过程称之为 effect 事件触发。

而绑定订阅者的过程，就是依赖收集，每个 effect 函数就是依赖者（订阅者），而修改属性值的时候，就是触发一个 effect 事件。

# 响应式原理

`reactive` 代理的目标是对象，依赖收集时，最小单位是对象的每个属性。

```ts
type Dep = Set<ReactiveEffect>
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()
```

key 与 Dep 是一一对应的，即：一个 Key 对应一个 Dep，而 Dep 是一个 effect 集合

而每个 effect 中又保存了可以触发这个 effect 的所有事件源，从而形成双向依赖关系

依赖函数是通过 `createReactiveEffect` 创建的

**从源码可以看出，响应式的核心 API 就是 `reactive` 和 `ref`**

## 可以转换为响应式数据的函数

- reactive
- ref
- computed 返回值 `ComputedRefImpl` 类型 （在其他 effect 函数中使用时），_可以不考虑_

`RefImpl` 类型的 Ref 会触发
`ObjectRefImpl` 类型不会

## toRef、 toRefs 说明

```js
const a = { a: 323 }
const b = toRef(a, 'a')

let dummy = 0
watchEffect(() => {
  // 这里读取 b.value 不会收集依赖，因为 a 不是响应式对象
  dummy = b.value
})

// 以下都不会 trigger
a.a = 100
b.value = 32
```

由于 `toRef` 内部不会触发 trigger 和 track， 所以如果第一个参数是 plain object 的话，就不会触发依赖收集和监听。

# 对数组的优化

Vue 对数组原型的一些方法也进行了侦听，（不止数组）

## 使用 pauseTracking() 和 resetTracking() 的原因

当在 effect 函数中使用 push、pop、shift、unshift 的时候会读取 length 长度，而这个时候，如果不 pause ，那么就会收集 length 的依赖，而这些方法后续又会设置 lengt 的长度，导致 effect 函数又重新运行，执行这些方法，导致递归。

```js
const arr = reactive([])
effect(() => {
  // 这里默认会读取 length 属性，从而导致收集依赖，
  // 所以，当 effect 中存在 push、pop、shift、unshift、splice 的时候
  // 要使用 pauseTracking 停止收集依赖
  arr.push(1)
})
```

# 关键代码分析

## 对 createReactiveEffect 分析

```ts
function createReactiveEffect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions
): ReactiveEffect<T> {
  const effect = function reactiveEffect(): unknown {
    if (!effect.active) {
      return options.scheduler ? undefined : fn()
    }
    // 防止在当前 effect 中又触发了 trigger，导致递归
    if (!effectStack.includes(effect)) {
      /**
       * const obj = reactive({ prop: 'value', run: true })
       * effect(() => {
       *    dummy = obj.run ? obj.prop : 'other'
       * })
       *
       * 对于这种情况，我们要保证依赖的实时性。防止不需要的属性设置导致 effect 触发。
       */
      cleanup(effect)
      try {
        // 防止别的地方使用了 pauseTracking()，对数组的优化
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
```

## trigger 分析

```ts
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
        // 防止在当前 activeEffect 又触发，形成递归
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
```
