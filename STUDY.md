# 学习笔记

- 通过reactive声明的变量，在set操作的时候都需要对数组进行监听，需要判断他的长度和下标。在set操作的时候。

```js
// 1. 是数组，判断下标是否短于数组长度
// 2. 对象，判断是否拥有key值
const hadKey =
  isArray(target) && isIntegerKey(key)
    ? Number(key) < target.length
    : hasOwn(target, key)
```

- 在trigger阶段，如果是通过声明数组的length来将数组缩短。

```js
// 1.通过操作数组长度，将多出来的dep拿出来
// 2.array1[1,2,3] ==> array1.length = 2 ==> 3就要去掉
depsMap.forEach((dep, key) => {
  if (key === 'length' || key >= (newValue as number)) {
    deps.push(dep)
  }
})
```

- 只是声明了data，没有使用是不会触发get，等到在组件中使用get，就触发track，将当前组件环境的activeEffect赋予到targe绑定的key的set结构上，等到trigger的时候，就会去找到target的depsMap，触发里面的activeEffect。

- computed里面通过dirty字段来进行缓存，如果dirty变成了true（脏）则是需要重新计算
而 dirty 表示缓存是否可用，如果为 true，表示缓存脏了，需要重新计算，否则不用。

- computed数据是具有缓存特性的，只有在所依赖的数据发生改变，触发了所依赖数据的setter。setter触发其收集的依赖，便会执行到ComputedRefImpl构造函数中传入effect的调度方法，触发此ComputedRefImpl实例所收集的所有依赖其中会包括componentEffect及其他依赖此计算属性的数据。

- watch也是通过声明了ReactiveEffect，绑定了当前effect，当依赖的数据发生改变的时候，会触发effect里面的scheduler，调度器里面执行了watch里面的cb，新旧值也是写死传进来的。

```js
// 这里开始声明effect，依赖收集就会收集到当前的环境
// 依赖变动触发更新的时候就触发调度器cb
const effect = new ReactiveEffect(getter, scheduler)
```

- 通过watch绑定state.count,同时页面中也使用到了这个字段，所有在targetMap(state)==>depsMap(count)==>dep[ReactiveEffect(watch),ReactiveEffect(componentUpdate)](w:1,n:0是原型属性),trigger阶段通过遍历触发dep。依次触发。
但是很多的key都绑定componentUpdate，如果每个数据改变都要触发页面更新，要耗费很多性能，所以componentUpdate的scheduler里面加入了quene(),这个方法是异步执行了，所以等到同步任务执行完毕之后再执行异步任务，所以$nextTicker为什么是在页面渲染好之后再执行呢，因为页面这个微任务在队列里面，后面加入的微任务需要前面的微任务执行完之后才能执行。

数据更新之后触发了trigger(set)，但是数据被访问了，就会重新触发track(get)。
