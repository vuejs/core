# VNode

在 Vue 中，VNode 的类型有：

1. 每次 patch 的时候，使用 renderComponentRoot 生成组件此刻最新的 vnode tree，称为 nextTree，此时的 nextTree 并没有绑定 DOM 元素，然后通过调用 patch(prevTree, nextTree) 进行比对，将 DOM 元素挂载到 nextTree 上。同时，由于 patch 的时候每个组件的 instance 是不会改变的，此时只要修改 instance.vnode 就可以。
2. currentComponent 这个属性主要是用于 mountComponent 的时候，在 setup 里面写的代码逻辑可以找到当前 instance。currentRenderComponent 主要是在 renderComponentRoot 的时候使用，即：执行 effect 的时候设置。
3. instance.update 执行的时候，会运行 renderComponentRoot 函数，这个函数会执行 render 方法，而 render 执行的时候会读取 instance 上的属性数据，从而触发依赖收集。
4. instance.update 被触发的条件只可能是在 render 方法中使用的属性被修改时。即只有在 render 中使用到的属性才会触发 instance.update 重新执行。
