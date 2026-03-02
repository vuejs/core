这三个是Vue官方runtime导出的所有函数，变量和类型。
我希望重新开发一个pure-vapor的项目，要求：
1、完全兼容vue-vapr的功能，但不需要兼容传统的vdom的vue逻辑
2、不需要 ssr的所有功能
3、不需要兼容 vue compat 模型
4、需要从createApp到生命周期都需要考虑到
5、不需要考虑 shared,reactivity这2个包的内容
那么我需要编写哪些函数，按照开发顺序，列举出之它们。

# pure-vapor 项目开发规划

## 一、需要实现的函数（按开发顺序）

### 1. 基础 DOM 操作 node.ts
- [x] `createTextNode` - 创建文本节点 
- [x] `createComment` - 创建注释节点 
- [x] `txt` - 获取文本
- [x] `child` - 获取子节点
- [x] `nthChild` - 获取第 n 个子节点
- [x] `next` - 获取下一个节点

### 2. 块操作 block.ts
- [x] `Block` - 块类型定义
- [x] `setInsertionState` - 设置插入状态
- [x] `insert` - 插入节点
- [x] `prepend` - 前置插入节点
- [x] `remove` - 移除节点

### 3. 属性操作 prop.ts
- [x] `setText` - 设置文本
- [x] `setBlockText` - 设置块文本
- [x] `setHtml` - 设置 HTML
- [x] `setBlockHtml` - 设置块 HTML
- [x] `setClass` - 设置类
- [x] `setStyle` - 设置样式
- [x] `setAttr` - 设置属性
- [x] `setValue` - 设置值
- [x] `setProp` - 设置属性
- [x] `setDOMProp` - 设置 DOM 属性
- [x] `setDynamicProps` - 设置动态属性
- [x] `setElementText` - 设置元素文本

### 4. 事件系统 event.ts
- [x] `on` - 绑定事件
- [x] `delegate` - 事件委托
- [x] `delegateEvents` - 委托事件
- [x] `setDynamicEvents` - 设置动态事件
- [x] `createInvoker` - 创建事件调用器 [遗留有 currentInstance]

### 5. 渲染系统
- `renderEffect` - 渲染效果
- `createIf` - 创建条件渲染
- `createKeyedFragment` - 创建键控片段
- `createFor` - 创建列表渲染
- `createForSlots` - 创建列表插槽
- `getRestElement` - 获取剩余元素
- `getDefaultValue` - 获取默认值
- `createDynamicComponent` - 创建动态组件

### 6. 组件系统
- `createComponent` - 创建组件
- `createComponentWithFallback` - 创建带回退的组件
- `createPlainElement` - 创建普通元素
- `isVaporComponent` - 检查是否为 Vapor 组件
- `FunctionalVaporComponent` - 函数式 Vapor 组件类型
- `VaporComponentInstance` - Vapor 组件实例类型

### 7. 插槽系统
- `createSlot` - 创建插槽
- `withVaporCtx` - 使用 Vapor 上下文

### 8. 模板操作
- [x] `template` - 从字符串生成模板 template.ts
- `createTemplateRefSetter` - 创建模板引用设置器  apiTemplateRef.ts 【依赖 core,dom】

### 9. CSS 变量
- `useVaporCssVars` - 使用 Vapor CSS 变量

### 10. 指令系统
- `applyVShow` - 应用 v-show 指令
- `applyTextModel` - 应用文本模型
- `applyRadioModel` - 应用单选框模型
- `applyCheckboxModel` - 应用复选框模型
- `applySelectModel` - 应用选择模型
- `applyDynamicModel` - 应用动态模型
- `withVaporDirectives` - 使用 Vapor 指令

### 11. 片段系统
- `isFragment` - 检查是否为片段
- `VaporFragment` - Vapor 片段
- `DynamicFragment` - 动态片段

### 12. 内置组件
- `VaporTeleport` - Vapor 传送门组件
- `VaporKeepAlive` - Vapor 保持活跃组件
- `VaporTransition` - Vapor 过渡组件
- `VaporTransitionGroup` - Vapor 过渡组组件

### 13. 应用系统
- `createVaporApp` - 创建 Vapor 应用实例
- `defineVaporComponent` - 定义 Vapor 组件
- `defineVaporAsyncComponent` - 定义 Vapor 异步组件
- `defineVaporCustomElement` - 定义 Vapor 自定义元素

### 14. 类型定义
- `VaporComponent` - Vapor 组件类型
- `VaporComponentOptions` - Vapor 组件选项类型
- `VaporSlot` - Vapor 插槽类型
- `VaporTransitionHooks` - Vapor 过渡钩子类型
- `VaporKeepAliveContext` - Vapor KeepAlive 上下文类型
- `DefineVaporComponent` - Vapor 组件定义类型
- `VaporPublicProps` - Vapor 公共属性类型
- `VaporRenderResult` - Vapor 渲染结果类型
- `VaporElement` - Vapor 元素类型
- `VaporElementConstructor` - Vapor 元素构造函数类型
- `VaporDirective` - Vapor 指令类型

## 二、开发步骤

### 阶段 1：项目初始化（1-2 天）
1. 创建项目目录结构
2. 配置构建工具（Vite/Rollup）
3. 初始化 TypeScript 配置
4. 设置基础测试环境

### 阶段 2：核心 DOM 操作（2-3 天）
1. 实现基础 DOM 操作函数
2. 实现块操作相关功能
3. 编写单元测试

### 阶段 3：属性和事件系统（2-3 天）
1. 实现属性操作函数
2. 实现事件系统
3. 编写集成测试

### 阶段 4：渲染系统（3-4 天）
1. 实现渲染效果和条件渲染
2. 实现列表渲染和动态组件
3. 测试渲染性能

### 阶段 5：组件系统（3-4 天）
1. 实现组件创建和管理
2. 实现插槽系统
3. 实现模板操作
4. 编写组件测试

### 阶段 6：指令和内置组件（2-3 天）
1. 实现指令系统
2. 实现内置组件
3. 测试组件交互

### 阶段 7：应用系统（2-3 天）
1. 实现应用创建和管理
2. 实现生命周期钩子
3. 测试完整应用流程

### 阶段 8：类型定义和文档（2-3 天）
1. 完善 TypeScript 类型定义
2. 编写 API 文档
3. 优化代码结构

### 阶段 9：性能优化和测试（2-3 天）
1. 性能测试和优化
2. 兼容性测试
3. 回归测试

## 三、项目结构

```
pure-vapor/
├── src/
│   ├── core/
│   │   ├── app.ts         # 应用创建和管理
│   │   ├── component.ts   # 组件系统
│   │   ├── render.ts      # 渲染系统
│   │   ├── directive.ts   # 指令系统
│   │   └── lifecycle.ts   # 生命周期管理
│   ├── dom/
│   │   ├── nodeOps.ts     # DOM 操作
│   │   ├── props.ts       # 属性操作
│   │   └── events.ts      # 事件系统
│   ├── components/
│   │   ├── Teleport.ts    # 传送门组件
│   │   ├── KeepAlive.ts   # 保持活跃组件
│   │   ├── Transition.ts  # 过渡组件
│   │   └── TransitionGroup.ts  # 过渡组组件
│   ├── api/
│   │   ├── index.ts       # 公共 API 导出
│   │   └── types.ts       # 类型定义
│   └── utils/
│       ├── shared.ts      # 共享工具函数
│       └── compiler.ts    # 编译器相关工具
├── test/
│   ├── unit/              # 单元测试
│   └── e2e/               # 端到端测试
├── tsconfig.json          # TypeScript 配置
├── package.json           # 项目配置
└── README.md              # 项目文档
```

## 四、核心功能特点

1. **高效渲染**：采用直接 DOM 操作，避免 VDOM 开销
2. **轻量设计**：排除 SSR 和兼容层，专注核心功能
3. **完整生态**：实现从应用创建到生命周期的完整功能
4. **类型安全**：完善的 TypeScript 类型定义
5. **模块化架构**：清晰的模块划分，便于维护和扩展
6. **性能优化**：针对 Vapor 模式的特定优化
7. **兼容性**：完全兼容 Vue Vapor 的功能和 API

## 五、技术优势

1. **性能提升**：相比传统 VDOM 实现，减少了虚拟节点创建和 diff 操作
2. **代码简洁**：直接操作 DOM，代码更直观易懂
3. **编译优化**：配合编译器生成高效的 Vapor 代码
4. **内存占用**：减少了 VDOM 节点的内存占用
5. **开发体验**：保持与 Vue 一致的 API 设计，降低学习成本

通过以上规划，您可以系统性地开发一个完整的 pure-vapor 项目，专注于高效的 DOM 操作和渲染性能，同时保持与 Vue Vapor 的功能兼容性。