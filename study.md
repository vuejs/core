## Vue3初始化流程分析
 - 应用程序实例创建过程 -> createApp()
  - 问题：如何创建实例，实例长什么样？
    - 创建实例：renderer.createApp()
    - 实例：{use(){}, component(){}, mount(){}}
 - 挂载过程   app.mount()
  - 问题：挂载都做了什么？
   - 创建根节点vnode
   - 执行render(虚拟dom生成真实dom)
    - 第一步生成vnode传递给patch函数转换为dom
    - 追加到宿主元素

- 总结：传入组件数据和状态转换为dom，并追加到宿主元素

### 学习方法
- 单步调试
- 查看调用栈