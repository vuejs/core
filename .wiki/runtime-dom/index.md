# 1. 排除掉从runtime-core中导出的变量， 函数， ts 类型， 列举一下仅仅从runtime-dom运行时导出的所有变量， 函数， ts 类型都有哪些？按分类列举一下.

## runtime-dom 独有导出（排除 runtime-core）

### 1. 核心函数（App 相关）

| 导出 | 说明 |
|------|------|
| `render` | 根渲染函数 |
| `hydrate` | 水合函数 |
| `createApp` | 创建 DOM 应用 |
| `createSSRApp` | 创建 SSR 应用 |
| `nodeOps` | DOM 节点操作 |
| `patchProp` | 属性 patching |

---

### 2. 自定义元素 (Custom Elements)

| 导出 | 说明 |
|------|------|
| `defineCustomElement` | 定义自定义元素 |
| `defineSSRCustomElement` | 定义 SSR 自定义元素 |
| `VueElement` | Vue 自定义元素基类 |
| `VueElementBase` | Vue 元素基础类 |
| `useShadowRoot` | 使用 Shadow DOM |
| `useHost` | 使用宿主元素 |
| `VueElementConstructor` (type) | 自定义元素构造函数类型 |
| `CustomElementOptions` (type) | 自定义元素选项类型 |

---

### 3. CSS 相关工具

| 导出 | 说明 |
|------|------|
| `useCssModule` | 使用 CSS Module |
| `useCssVars` | 使用 CSS 变量 |

---

### 4. 组件 (Components)

| 导出 | 说明 |
|------|------|
| `Transition` | 过渡组件 |
| `TransitionGroup` | 过渡组组件 |
| `TransitionProps` (type) | 过渡组件 Props 类型 |
| `TransitionGroupProps` (type) | 过渡组 Props 类型 |

---

### 5. 指令 (Directives)

**vModel 指令：**
| 导出 | 说明 |
|------|------|
| `vModelText` | 文本输入指令 |
| `vModelCheckbox` | 复选框指令 |
| `vModelRadio` | 单选框指令 |
| `vModelSelect` | 选择框指令 |
| `vModelDynamic` | 动态指令 |

**vOn 指令：**
| 导出 | 说明 |
|------|------|
| `withModifiers` | 带修饰符的事件处理 |
| `withKeys` | 带按键修饰符 |

**vShow 指令：**
| 导出 | 说明 |
|------|------|
| `vShow` | 显示/隐藏指令 |

---

### 6. JSX

| 导出 | 说明 |
|------|------|
| `JSX` | JSX 命名空间（从 './jsx' 导出） |

---

### 7. SSR 相关

| 导出 | 说明 |
|------|------|
| `initDirectivesForSSR` | 初始化 SSR 指令 |

---

### 8. Internal 导出（仅供内部使用）

**nodeOps 模块：**
| 导出 | 说明 |
|------|------|
| `svgNS` | SVG 命名空间 |
| `unsafeToTrustedHTML` | HTML 转换 |

**style 模块：**
| 导出 | 说明 |
|------|------|
| `patchStyle` | 样式 patching |

**patchProp 模块：**
| 导出 | 说明 |
|------|------|
| `shouldSetAsProp` | 判断是否应设置为属性 |

**useCssVars 模块：**
| 导出 | 说明 |
|------|------|
| `baseUseCssVars` | 基础 CSS 变量处理 |
| `setVarsOnNode` | 在节点上设置变量 |

**vShow 指令内部：**
| 导出 | 说明 |
|------|------|
| `vShowOriginalDisplay` | 原始 display 值 |
| `vShowHidden` | 隐藏状态标记 |
| `VShowElement` (type) | vShow 元素类型 |

**vModel 指令内部：**
| 导出 | 说明 |
|------|------|
| `vModelTextInit` | 文本模型初始化 |
| `vModelTextUpdate` | 文本模型更新 |
| `vModelCheckboxInit` | 复选框初始化 |
| `vModelCheckboxUpdate` | 复选框更新 |
| `vModelGetValue` | 获取模型值 |
| `vModelSelectInit` | 选择框初始化 |
| `vModelSetSelected` | 设置选中状态 |

**Transition 组件内部：**
| 导出 | 说明 |
|------|------|
| `resolveTransitionProps` | 解析过渡属性 |
| `TransitionPropsValidators` | 属性验证器 |
| `forceReflow` | 强制重排 |
| `ElementWithTransition` (type) | 带过渡的元素类型 |

**TransitionGroup 组件内部：**
| 导出 | 说明 |
|------|------|
| `hasCSSTransform` | 是否有 CSS 变换 |
| `callPendingCbs` | 调用待定回调 |
| `handleMovedChildren` | 处理移动的子元素 |
| `baseApplyTranslation` | 应用基础位移 |

**attrs 模块：**
| 导出 | 说明 |
|------|------|
| `xlinkNS` | XLink 命名空间 |

**内部工具函数：**
| 导出 | 说明 |
|------|------|
| `ensureRenderer` | 确保渲染器创建 |
| `ensureHydrationRenderer` | 确保水合渲染器创建 |
| `normalizeContainer` | 规范化容器 |

---

### ⚠️ 注意：从 runtime-core 透传的导出

以下是从 `@vue/runtime-core` 导入并重新导出的，**不属于 runtime-dom 独有**：

```ts
export * from '@vue/runtime-core'
```

包括：`h`, `Component`, `createVNode`, `defineComponent`, `reactive`, `ref`, `computed`, `watch`, `onMounted`, `nextTick`, `Renderer`, `App` 等等完整的 runtime-core API。