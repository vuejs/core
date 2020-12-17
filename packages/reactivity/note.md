总体：

```js
const a = reactive({ a1: 'a1', a2: 'a2' })
const b = reactive({ b1: 'b1', b2: 'b2' })

watchEffect(()=>{
    const a
})
```

# reactive 分析

1. 定义代理对象的类型

createReactiveObject 功能：

- 使用 createReaciveObject 将一个对象变成响应式的
- 缓存代理目标对象

# effect 分析
