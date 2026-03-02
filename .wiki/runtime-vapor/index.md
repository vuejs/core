# 1. 列举一下仅仅从runtime-vapor 运行时导出的所有变量， 函数， ts 类型都有哪些？按分类列举一下.

# runtime-vapor 运行时独有的导出内容

## 一、公共 API

### 应用创建
- `createVaporApp` - 创建 Vapor 应用实例
- `createVaporSSRApp` - 创建 Vapor SSR 应用实例

### 组件定义
- `defineVaporComponent` - 定义 Vapor 组件
- `defineVaporAsyncComponent` - 定义 Vapor 异步组件
- `defineVaporCustomElement` - 定义 Vapor 自定义元素
- `defineVaporSSRCustomElement` - 定义 Vapor SSR 自定义元素

### 类型
- `DefineVaporComponent` - Vapor 组件定义类型
- `VaporPublicProps` - Vapor 公共属性类型
- `VaporRenderResult` - Vapor 渲染结果类型
- `VaporElement` - Vapor 元素类型
- `VaporElementConstructor` - Vapor 元素构造函数类型
- `VaporDirective` - Vapor 指令类型

### 内置组件
- `VaporTeleport` - Vapor 传送门组件
- `VaporKeepAlive` - Vapor 保持活跃组件
- `VaporTransition` - Vapor 过渡组件
- `VaporTransitionGroup` - Vapor 过渡组组件

### 插件
- `vaporInteropPlugin` - Vapor 与 VDOM 互操作插件

## 二、编译器使用的 API

### 块操作
- `insert` - 插入节点
- `prepend` - 前置插入节点
- `remove` - 移除节点
- `setInsertionState` - 设置插入状态
- `Block` - 块类型

### 组件操作
- `createComponent` - 创建组件
- `createComponentWithFallback` - 创建带回退的组件
- `createPlainElement` - 创建普通元素
- `isVaporComponent` - 检查是否为 Vapor 组件
- `FunctionalVaporComponent` - 函数式 Vapor 组件类型
- `VaporComponentInstance` - Vapor 组件实例类型

### 渲染
- `renderEffect` - 渲染效果
- `createIf` - 创建条件渲染
- `createKeyedFragment` - 创建键控片段
- `createFor` - 创建列表渲染
- `createForSlots` - 创建列表插槽
- `getRestElement` - 获取剩余元素
- `getDefaultValue` - 获取默认值
- `createDynamicComponent` - 创建动态组件

### 节点操作
- `createTextNode` - 创建文本节点
- `child` - 获取子节点
- `nthChild` - 获取第 n 个子节点
- `next` - 获取下一个节点
- `txt` - 文本操作

### 属性操作
- `setText` - 设置文本
- `setBlockText` - 设置块文本
- `setHtml` - 设置 HTML
- `setBlockHtml` - 设置块 HTML
- `setClass` - 设置类
- `setStyle` - 设置样式
- `setAttr` - 设置属性
- `setValue` - 设置值
- `setProp` - 设置属性
- `setDOMProp` - 设置 DOM 属性
- `setDynamicProps` - 设置动态属性
- `setElementText` - 设置元素文本

### 事件操作
- `on` - 绑定事件
- `delegate` - 事件委托
- `delegateEvents` - 委托事件
- `setDynamicEvents` - 设置动态事件
- `createInvoker` - 创建事件调用器

### 插槽操作
- `createSlot` - 创建插槽
- `withVaporCtx` - 使用 Vapor 上下文

### 模板操作
- `template` - 模板操作

### 模板引用
- `createTemplateRefSetter` - 创建模板引用设置器

### CSS 变量
- `useVaporCssVars` - 使用 Vapor CSS 变量

### 指令
- `applyVShow` - 应用 v-show 指令
- `applyTextModel` - 应用文本模型
- `applyRadioModel` - 应用单选框模型
- `applyCheckboxModel` - 应用复选框模型
- `applySelectModel` - 应用选择模型
- `applyDynamicModel` - 应用动态模型
- `withVaporDirectives` - 使用 Vapor 指令

### 片段
- `isFragment` - 检查是否为片段
- `VaporFragment` - Vapor 片段
- `DynamicFragment` - 动态片段

## 三、类型定义

### 组件类型
- `VaporComponent` - Vapor 组件类型
- `VaporComponentOptions` - Vapor 组件选项类型

### 插槽类型
- `VaporSlot` - Vapor 插槽类型

### 过渡类型
- `VaporTransitionHooks` - Vapor 过渡钩子类型

### 上下文类型
- `VaporKeepAliveContext` - Vapor KeepAlive 上下文类型

## 总结

runtime-vapor 提供了一套专门为高效渲染优化的 API，与传统的 runtime-core 相比，它采用了更直接的 DOM 操作方式，避免了 VDOM 的开销。这些独有的导出内容涵盖了从应用创建、组件定义到 DOM 操作的各个方面，为编译器生成的 Vapor 代码提供了完整的运行时支持。