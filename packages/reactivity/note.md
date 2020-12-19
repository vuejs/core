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

##
