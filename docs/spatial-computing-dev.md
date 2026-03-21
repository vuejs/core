# Vue Spatial Computing 实现指南

> 本文档为 Vue 3 核心仓库（fork）添加空间计算（Spatial Computing）支持的详细开发指南。
> 目标平台：Apple visionOS，通过 SwiftUI 原生渲染。

---

## 目录

1. [总体概述](#1-总体概述)
2. [compiler-sfc 修改](#2-compiler-sfc-修改)
3. [compiler-spatial 新包](#3-compiler-spatial-新包)
4. [runtime-spatial 新包](#4-runtime-spatial-新包)
5. [Swift 侧模板](#5-swift-侧模板)
6. [构建与测试策略](#6-构建与测试策略)
7. [开发阶段与任务分解](#7-开发阶段与任务分解)

---

## 1. 总体概述

### 1.1 本项目的定位

本仓库是 Vue 3 核心编译器与运行时的 fork 版本，作为 **Vue Spatial Computing** 的编译器和运行时基础层。现有的包结构如下：

```
packages/
  compiler-core/        # 平台无关的编译核心（AST、transform、codegen）
  compiler-dom/         # DOM 平台编译器
  compiler-sfc/         # 单文件组件解析器（.vue 文件入口）
  compiler-ssr/         # SSR 编译器
  runtime-core/         # 平台无关运行时核心（响应式调度、虚拟节点、自定义渲染器接口）
  runtime-dom/          # DOM 平台运行时
  runtime-test/         # 测试用自定义渲染器（可作为参考实现）
  reactivity/           # 响应式系统
  shared/               # 工具函数
  server-renderer/      # 服务端渲染器
  vue/                  # 完整构建入口
  vue-compat/           # 兼容层
```

空间计算支持需要增加 **两个新包** 并修改一个现有包：

| 变更 | 说明 |
|------|------|
| `compiler-sfc`（修改） | 解析 `<script setup spatial>`、`<template spatial>`、`<style spatial>` |
| `compiler-spatial`（新建） | 将 Vue 模板 AST 编译为 SwiftUI 源码 |
| `runtime-spatial`（新建） | JavaScriptCore 桥接运行时，自定义渲染器 |

### 1.2 整体数据流

```
.vue spatial 文件
      │
      ▼
compiler-sfc (parse)          ← 识别 spatial 属性，分发到对应管线
      │
      ├──► compiler-spatial   ← 模板 AST → SwiftUI 代码生成
      │         │
      │         ▼
      │    SwiftUI .swift 文件（编译期产物）
      │
      └──► script 编译         ← 标准 <script setup> 编译，生成 JS
                │
                ▼
           JS Bundle（运行时由 JavaScriptCore 执行）
                │
                ▼
         runtime-spatial       ← 自定义渲染器，通过 IPC 桥接驱动 SwiftUI 状态更新
                │
                ▼
         Swift 侧 VueViewModel（ObservableObject）
                │
                ▼
         SwiftUI 原生渲染
```

### 1.3 设计原则

1. **编译期最大化**：尽可能在编译期完成 Vue 模板到 SwiftUI 的转换，减少运行时桥接开销
2. **最小侵入**：对现有 `compiler-sfc` 的修改限定在解析层面，不影响 DOM/SSR 管线
3. **复用 `compiler-core` AST**：spatial 编译器复用现有的 AST 节点类型和 transform 架构
4. **遵循 `runtime-test` 模式**：`runtime-spatial` 的自定义渲染器参照 `runtime-test` 的 `createRenderer` 接口实现

---

## 2. compiler-sfc 修改

### 2.1 概述

`compiler-sfc` 是 `.vue` 单文件组件的入口解析器。需要修改三个核心文件：

- `packages/compiler-sfc/src/parse.ts` — SFC 解析与描述符
- `packages/compiler-sfc/src/compileScript.ts` — script 编译管线路由
- `packages/compiler-sfc/src/index.ts` — 公共导出

### 2.2 parse.ts 修改

#### 2.2.1 SFCDescriptor 接口扩展

在 `packages/compiler-sfc/src/parse.ts` 中，现有的 `SFCDescriptor` 接口定义在第 72-96 行：

```typescript
// 现有接口
export interface SFCDescriptor {
  filename: string
  source: string
  template: SFCTemplateBlock | null
  script: SFCScriptBlock | null
  scriptSetup: SFCScriptBlock | null
  styles: SFCStyleBlock[]
  customBlocks: SFCBlock[]
  cssVars: string[]
  slotted: boolean
  shouldForceReload: (prevImports: Record<string, ImportBinding>) => boolean
}
```

**需要添加的字段：**

```typescript
export interface SFCDescriptor {
  filename: string
  source: string
  template: SFCTemplateBlock | null
  script: SFCScriptBlock | null
  scriptSetup: SFCScriptBlock | null
  styles: SFCStyleBlock[]
  customBlocks: SFCBlock[]
  cssVars: string[]
  slotted: boolean
  shouldForceReload: (prevImports: Record<string, ImportBinding>) => boolean

  // ===== 新增 Spatial 字段 =====

  /**
   * 是否为空间计算组件。
   * 当任一块包含 spatial 属性时为 true。
   */
  spatial: boolean

  /**
   * <script setup spatial> 块。
   * 与普通 scriptSetup 共享 SFCScriptBlock 类型，
   * 但会被路由到 spatial 编译管线。
   */
  scriptSetupSpatial: SFCScriptBlock | null

  /**
   * <template spatial> 块。
   * 将被发送到 compiler-spatial 而非 compiler-dom。
   */
  templateSpatial: SFCTemplateBlock | null

  /**
   * <style spatial> 块（可多个）。
   * 将被编译为 SwiftUI modifier 而非 CSS。
   */
  stylesSpatial: SFCSpatialStyleBlock[]
}
```

#### 2.2.2 新增 SFCSpatialStyleBlock 类型

```typescript
export interface SFCSpatialStyleBlock extends SFCBlock {
  type: 'style'
  spatial: true
  /**
   * 目标 SwiftUI 视图的范围限定。
   * 类似 CSS scoped，但语义为 SwiftUI modifier 的作用域。
   */
  scoped?: boolean
}
```

#### 2.2.3 SFCScriptBlock 扩展

在现有 `SFCScriptBlock`（第 50-64 行）中添加 `spatial` 标识：

```typescript
export interface SFCScriptBlock extends SFCBlock {
  type: 'script'
  setup?: string | boolean
  spatial?: boolean              // ← 新增
  bindings?: BindingMetadata
  imports?: Record<string, ImportBinding>
  scriptAst?: import('@babel/types').Statement[]
  scriptSetupAst?: import('@babel/types').Statement[]
  warnings?: string[]
  deps?: string[]
}
```

#### 2.2.4 SFCTemplateBlock 扩展

```typescript
export interface SFCTemplateBlock extends SFCBlock {
  type: 'template'
  ast?: RootNode
  spatial?: boolean              // ← 新增
}
```

#### 2.2.5 parse 函数修改

在 `parse()` 函数（第 107 行起）中，修改描述符初始化和节点遍历逻辑：

```typescript
export function parse(
  source: string,
  options: SFCParseOptions = {},
): SFCParseResult {
  // ... 缓存逻辑不变 ...

  const descriptor: SFCDescriptor = {
    filename,
    source,
    template: null,
    script: null,
    scriptSetup: null,
    styles: [],
    customBlocks: [],
    cssVars: [],
    slotted: false,
    shouldForceReload: prevImports => hmrShouldReload(prevImports, descriptor),

    // ===== 新增 =====
    spatial: false,
    scriptSetupSpatial: null,
    templateSpatial: null,
    stylesSpatial: [],
  }

  // ... ast 解析不变 ...

  ast.children.forEach(node => {
    if (node.type !== NodeTypes.ELEMENT) {
      return
    }
    if (
      ignoreEmpty &&
      node.tag !== 'template' &&
      isEmpty(node) &&
      !hasSrc(node)
    ) {
      return
    }
    switch (node.tag) {
      case 'template': {
        const templateBlock = createBlock(
          node,
          source,
          false,
        ) as SFCTemplateBlock

        // ===== 新增：检测 spatial 属性 =====
        const isSpatial = !!templateBlock.attrs.spatial

        if (isSpatial) {
          if (!descriptor.templateSpatial) {
            templateBlock.spatial = true
            descriptor.templateSpatial = templateBlock
            descriptor.spatial = true
            if (!templateBlock.attrs.src) {
              templateBlock.ast = createRoot(node.children, source)
            }
          } else {
            errors.push(createDuplicateBlockError(node))
          }
        } else {
          // 原有逻辑
          if (!descriptor.template) {
            descriptor.template = templateBlock
            if (!templateBlock.attrs.src) {
              templateBlock.ast = createRoot(node.children, source)
            }
            if (templateBlock.attrs.functional) {
              // ... 原有 functional 警告 ...
            }
          } else {
            errors.push(createDuplicateBlockError(node))
          }
        }
        break
      }

      case 'script': {
        const scriptBlock = createBlock(node, source, pad) as SFCScriptBlock
        const isSetup = !!scriptBlock.attrs.setup
        const isSpatial = !!scriptBlock.attrs.spatial

        // ===== 新增：spatial script 处理 =====
        if (isSetup && isSpatial) {
          if (!descriptor.scriptSetupSpatial) {
            scriptBlock.spatial = true
            descriptor.scriptSetupSpatial = scriptBlock
            descriptor.spatial = true
            break
          }
          errors.push(createDuplicateBlockError(node, true))
          break
        }

        // 原有逻辑
        if (isSetup && !descriptor.scriptSetup) {
          descriptor.scriptSetup = scriptBlock
          break
        }
        if (!isSetup && !descriptor.script) {
          descriptor.script = scriptBlock
          break
        }
        errors.push(createDuplicateBlockError(node, isSetup))
        break
      }

      case 'style': {
        const styleBlock = createBlock(node, source, pad) as SFCStyleBlock
        const isSpatial = !!styleBlock.attrs.spatial

        // ===== 新增：spatial style 处理 =====
        if (isSpatial) {
          const spatialStyleBlock: SFCSpatialStyleBlock = {
            ...styleBlock,
            spatial: true,
            scoped: !!styleBlock.attrs.scoped,
          }
          descriptor.stylesSpatial.push(spatialStyleBlock)
          descriptor.spatial = true
          break
        }

        // 原有逻辑
        if (styleBlock.attrs.vars) {
          errors.push(
            new SyntaxError(
              `<style vars> has been replaced by a new proposal: ` +
                `https://github.com/vuejs/rfcs/pull/231`,
            ),
          )
        }
        descriptor.styles.push(styleBlock)
        break
      }

      default:
        descriptor.customBlocks.push(createBlock(node, source, pad))
        break
    }
  })

  // ... 后续逻辑不变 ...
}
```

#### 2.2.6 createBlock 函数修改

在 `createBlock` 函数（第 314 行起）中，添加对 `spatial` 属性的解析：

```typescript
function createBlock(
  node: ElementNode,
  source: string,
  pad: SFCParseOptions['pad'],
): SFCBlock {
  // ... 现有逻辑 ...

  node.props.forEach(p => {
    if (p.type === NodeTypes.ATTRIBUTE) {
      const name = p.name
      attrs[name] = p.value ? p.value.content || true : true
      if (name === 'lang') {
        block.lang = p.value && p.value.content
      } else if (name === 'src') {
        block.src = p.value && p.value.content
      } else if (type === 'style') {
        if (name === 'scoped') {
          ;(block as SFCStyleBlock).scoped = true
        } else if (name === 'module') {
          ;(block as SFCStyleBlock).module = attrs[name]
        }
      } else if (type === 'script' && name === 'setup') {
        ;(block as SFCScriptBlock).setup = attrs.setup
      }
      // ===== 新增 =====
      // spatial 属性在上层 switch 中处理，这里只记录到 attrs
    }
  })
  return block
}
```

### 2.3 compileScript.ts 修改

在 `packages/compiler-sfc/src/compileScript.ts` 的 `compileScript` 函数（第 168 行起）中，添加 spatial 管线路由：

#### 2.3.1 SFCScriptCompileOptions 扩展

```typescript
export interface SFCScriptCompileOptions {
  // ... 现有选项 ...

  /**
   * 空间计算编译选项。
   * 当 SFC 包含 spatial 标记时，编译器将使用此配置。
   */
  spatialOptions?: {
    /**
     * 是否启用空间计算编译管线。
     * @default true（当检测到 spatial 标记时）
     */
    enabled?: boolean
    /**
     * SwiftUI 代码生成的目标 Swift 版本。
     * @default '5.9'
     */
    swiftVersion?: string
    /**
     * 空间计算编译器实例。
     * 延迟导入以避免非 spatial 场景的额外开销。
     */
    compiler?: SpatialCompiler
  }
}

/**
 * 空间计算编译器接口。
 * 由 @vue/compiler-spatial 实现。
 */
export interface SpatialCompiler {
  compile(
    template: string,
    options: SpatialCompileOptions,
  ): SpatialCompileResult

  compileStyle(
    source: string,
    options: SpatialStyleCompileOptions,
  ): SpatialStyleCompileResult
}

export interface SpatialCompileOptions {
  filename: string
  sourceMap?: boolean
  bindingMetadata?: BindingMetadata
}

export interface SpatialCompileResult {
  code: string           // 生成的 SwiftUI 代码
  ast?: any              // Spatial AST（调试用）
  errors: CompilerError[]
  tips: string[]
}

export interface SpatialStyleCompileOptions {
  filename: string
  scoped?: boolean
}

export interface SpatialStyleCompileResult {
  modifiers: string      // 生成的 SwiftUI modifier 代码
  errors: CompilerError[]
}
```

#### 2.3.2 compileScript 入口路由

在 `compileScript` 函数的开头添加 spatial 分支：

```typescript
export function compileScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions,
): SFCScriptBlock {
  // ===== 新增：Spatial 管线路由 =====
  if (sfc.spatial && sfc.scriptSetupSpatial) {
    return compileSpatialScript(sfc, options)
  }

  // ... 原有完整逻辑不变 ...
}

/**
 * 编译 <script setup spatial> 块。
 *
 * 与标准 compileScript 的关键区别：
 * 1. 使用 scriptSetupSpatial 而非 scriptSetup
 * 2. 模板编译路由到 compiler-spatial
 * 3. 生成的代码将在 JavaScriptCore 而非浏览器中运行
 */
function compileSpatialScript(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions,
): SFCScriptBlock {
  const spatialScript = sfc.scriptSetupSpatial!

  // 复用标准 script 编译处理响应式逻辑
  // 将 scriptSetupSpatial 临时赋值给 scriptSetup 以复用现有管线
  const syntheticSfc: SFCDescriptor = {
    ...sfc,
    scriptSetup: spatialScript,
    template: null, // 模板由 compiler-spatial 单独处理
  }

  const result = compileScript(syntheticSfc, {
    ...options,
    // spatial 模式下不内联模板（模板走独立编译管线）
    inlineTemplate: false,
    templateOptions: {
      ...options.templateOptions,
      compilerOptions: {
        ...options.templateOptions?.compilerOptions,
        // spatial 运行时模块名
        runtimeModuleName: '@vue/runtime-spatial',
      },
    },
  })

  return result
}
```

### 2.4 index.ts 修改

在 `packages/compiler-sfc/src/index.ts` 中添加 spatial 相关导出：

```typescript
// ===== 新增 Spatial 导出 =====

// Types
export type {
  SpatialCompiler,
  SpatialCompileOptions,
  SpatialCompileResult,
  SpatialStyleCompileOptions,
  SpatialStyleCompileResult,
} from './compileScript'

export type {
  SFCSpatialStyleBlock,
} from './parse'
```

### 2.5 .vue 文件示例

修改完成后，以下 `.vue` 文件格式将被正确解析：

```vue
<!-- HelloSpatial.vue -->
<script setup spatial lang="ts">
import { ref } from 'vue'
import { useSpatialGesture } from '@vue/runtime-spatial'

const count = ref(0)
const { onTap } = useSpatialGesture()

function increment() {
  count.value++
}
</script>

<template spatial>
  <spatial-window title="计数器">
    <v-stack spacing="20">
      <text font="largeTitle">{{ count }}</text>
      <button @tap="increment">+1</button>
    </v-stack>
  </spatial-window>
</template>

<style spatial scoped>
text {
  foreground-color: primary;
  padding: 16;
}
button {
  button-style: borderedProminent;
  tint: blue;
}
</style>
```

解析结果中 `SFCDescriptor` 的关键字段为：

```typescript
{
  spatial: true,
  scriptSetupSpatial: { /* SFCScriptBlock, spatial: true */ },
  templateSpatial: { /* SFCTemplateBlock, spatial: true, ast: RootNode */ },
  stylesSpatial: [{ /* SFCSpatialStyleBlock, spatial: true */ }],
  // 标准字段保持为 null/空
  template: null,
  scriptSetup: null,
  styles: [],
}
```

---

## 3. compiler-spatial 新包

### 3.1 目录结构

```
packages/compiler-spatial/
  package.json
  src/
    index.ts                         # 公共 API
    codegen.ts                       # SwiftUI 代码生成器
    parse.ts                         # Spatial 模板 AST 预处理
    options.ts                       # 编译选项类型定义
    errors.ts                        # Spatial 编译错误码
    transforms/
      transformElement.ts            # Vue 元素 → SwiftUI 视图映射
      transformDirective.ts          # v-if/v-for/v-model → Swift 控制流
      transformEvent.ts              # @tap/@drag → 手势/动作绑定
      transformStyle.ts              # <style spatial> → SwiftUI modifiers
      transformSlot.ts               # <slot> → @ViewBuilder 参数
      transformText.ts               # 文本节点 → Text() 视图
      transformInterpolation.ts      # {{ expr }} → Swift 字符串插值
    components/
      spatialWindow.ts               # <spatial-window> → WindowGroup
      spatialVolume.ts               # <spatial-volume> → volumetric WindowGroup
      spatialImmersive.ts            # <spatial-immersive> → ImmersiveSpace
    utils/
      swiftTypes.ts                  # Swift 类型系统映射
      swiftFormat.ts                 # Swift 代码格式化工具
      swiftIdentifier.ts             # Swift 标识符合法性检查
  __tests__/
    codegen.spec.ts
    transformElement.spec.ts
    transformDirective.spec.ts
    transformEvent.spec.ts
    snapshot/                        # SwiftUI 代码生成快照测试
```

### 3.2 package.json

```json
{
  "name": "@vue/compiler-spatial",
  "version": "0.1.0",
  "description": "Vue template to SwiftUI compiler for spatial computing",
  "main": "dist/compiler-spatial.cjs.js",
  "module": "dist/compiler-spatial.esm-bundler.js",
  "types": "dist/compiler-spatial.d.ts",
  "files": ["dist"],
  "buildOptions": {
    "name": "VueCompilerSpatial",
    "formats": ["esm-bundler", "cjs"]
  },
  "dependencies": {
    "@vue/compiler-core": "workspace:*",
    "@vue/shared": "workspace:*"
  },
  "devDependencies": {
    "@vue/compiler-sfc": "workspace:*"
  }
}
```

### 3.3 index.ts — 公共 API

```typescript
// packages/compiler-spatial/src/index.ts

import { type RootNode, baseParse } from '@vue/compiler-core'
import { transform } from './transform'
import { generate } from './codegen'
import type {
  SpatialCompileOptions,
  SpatialCompileResult,
  SpatialStyleCompileOptions,
  SpatialStyleCompileResult,
} from './options'

export function compile(
  source: string | RootNode,
  options: SpatialCompileOptions = {},
): SpatialCompileResult {
  const ast = typeof source === 'string' ? baseParse(source) : source

  const errors: any[] = []
  const tips: string[] = []

  // 1. transform: 遍历 AST 并标注 spatial 元数据
  const transformedAst = transform(ast, {
    ...options,
    onError: e => errors.push(e),
    onWarn: w => tips.push(w.message),
  })

  // 2. codegen: 从标注后的 AST 生成 SwiftUI 代码
  const { code } = generate(transformedAst, options)

  return {
    code,
    ast: transformedAst,
    errors,
    tips,
  }
}

export function compileStyle(
  source: string,
  options: SpatialStyleCompileOptions = {},
): SpatialStyleCompileResult {
  // 解析类 CSS 语法，生成 SwiftUI modifier 调用链
  const { modifiers, errors } = parseSpatialStyle(source, options)
  return { modifiers, errors }
}

// 重新导出类型
export type {
  SpatialCompileOptions,
  SpatialCompileResult,
  SpatialStyleCompileOptions,
  SpatialStyleCompileResult,
} from './options'

export { generate } from './codegen'
export { transform } from './transform'
```

### 3.4 元素映射表

`transformElement.ts` 中定义 Vue 模板元素到 SwiftUI 视图的完整映射：

#### 3.4.1 布局视图映射

| Vue 模板元素 | SwiftUI 视图 | 说明 |
|-------------|-------------|------|
| `<v-stack>` | `VStack` | 垂直堆栈 |
| `<h-stack>` | `HStack` | 水平堆栈 |
| `<z-stack>` | `ZStack` | Z 轴堆栈 |
| `<spacer>` | `Spacer()` | 弹性间距 |
| `<divider>` | `Divider()` | 分隔线 |
| `<scroll-view>` | `ScrollView` | 滚动容器 |
| `<lazy-v-stack>` | `LazyVStack` | 懒加载垂直堆栈 |
| `<lazy-h-stack>` | `LazyHStack` | 懒加载水平堆栈 |
| `<grid>` | `Grid` | 网格布局 |
| `<grid-row>` | `GridRow` | 网格行 |
| `<group>` | `Group` | 分组容器 |

#### 3.4.2 内容视图映射

| Vue 模板元素 | SwiftUI 视图 | 说明 |
|-------------|-------------|------|
| `<text>` | `Text` | 文本视图 |
| `<label>` | `Label` | 带图标的标签 |
| `<image>` | `Image` | 图片 |
| `<async-image>` | `AsyncImage` | 异步加载图片 |
| `<button>` | `Button` | 按钮 |
| `<link>` | `Link` | 链接 |
| `<toggle>` | `Toggle` | 开关 |
| `<slider>` | `Slider` | 滑块 |
| `<stepper>` | `Stepper` | 步进器 |
| `<picker>` | `Picker` | 选择器 |
| `<date-picker>` | `DatePicker` | 日期选择器 |
| `<color-picker>` | `ColorPicker` | 颜色选择器 |
| `<text-field>` | `TextField` | 文本输入框 |
| `<secure-field>` | `SecureField` | 密码输入框 |
| `<text-editor>` | `TextEditor` | 多行文本编辑器 |
| `<progress-view>` | `ProgressView` | 进度指示 |

#### 3.4.3 导航视图映射

| Vue 模板元素 | SwiftUI 视图 | 说明 |
|-------------|-------------|------|
| `<navigation-stack>` | `NavigationStack` | 导航堆栈 |
| `<navigation-link>` | `NavigationLink` | 导航链接 |
| `<tab-view>` | `TabView` | 标签页视图 |
| `<tab>` | `Tab` | 标签页项 |

#### 3.4.4 空间计算专用视图映射

| Vue 模板元素 | SwiftUI 视图/场景 | 说明 |
|-------------|-------------------|------|
| `<spatial-window>` | `WindowGroup` | 标准窗口 |
| `<spatial-volume>` | `WindowGroup` + `.windowStyle(.volumetric)` | 体积窗口 |
| `<spatial-immersive>` | `ImmersiveSpace` | 沉浸式空间 |
| `<model-3d>` | `Model3D` | 3D 模型加载 |
| `<reality-view>` | `RealityView` | RealityKit 场景 |
| `<ornament>` | `.ornament()` modifier | 窗口装饰件 |
| `<spatial-tap>` | `.gesture(TapGesture())` | 空间点击区域 |
| `<spatial-drag>` | `.gesture(DragGesture())` | 空间拖拽区域 |

#### 3.4.5 transformElement.ts 核心实现

```typescript
// packages/compiler-spatial/src/transforms/transformElement.ts

import {
  type ElementNode,
  type NodeTransform,
  NodeTypes,
  ElementTypes,
} from '@vue/compiler-core'

/**
 * 元素标签 → SwiftUI 视图类型的映射表。
 * key 为 kebab-case Vue 模板标签，value 为 SwiftUI 类型名。
 */
export const ELEMENT_MAP: Record<string, string> = {
  // 布局
  'v-stack': 'VStack',
  'h-stack': 'HStack',
  'z-stack': 'ZStack',
  'spacer': 'Spacer',
  'divider': 'Divider',
  'scroll-view': 'ScrollView',
  'lazy-v-stack': 'LazyVStack',
  'lazy-h-stack': 'LazyHStack',
  'grid': 'Grid',
  'grid-row': 'GridRow',
  'group': 'Group',

  // 内容
  'text': 'Text',
  'label': 'Label',
  'image': 'Image',
  'async-image': 'AsyncImage',
  'button': 'Button',
  'link': 'Link',
  'toggle': 'Toggle',
  'slider': 'Slider',
  'stepper': 'Stepper',
  'picker': 'Picker',
  'date-picker': 'DatePicker',
  'color-picker': 'ColorPicker',
  'text-field': 'TextField',
  'secure-field': 'SecureField',
  'text-editor': 'TextEditor',
  'progress-view': 'ProgressView',

  // 导航
  'navigation-stack': 'NavigationStack',
  'navigation-link': 'NavigationLink',
  'tab-view': 'TabView',
  'tab': 'Tab',

  // 空间计算
  'spatial-window': 'WindowGroup',
  'spatial-volume': 'WindowGroup',
  'spatial-immersive': 'ImmersiveSpace',
  'model-3d': 'Model3D',
  'reality-view': 'RealityView',
}

/**
 * 需要特殊修饰符的元素。
 * 这些元素在映射为 SwiftUI 视图后，还需要附加特定的 modifier。
 */
export const ELEMENT_MODIFIERS: Record<string, string[]> = {
  'spatial-volume': ['.windowStyle(.volumetric)'],
}

/**
 * 属性名映射表：Vue 模板属性 → SwiftUI 参数/modifier。
 */
export const PROP_MAP: Record<string, Record<string, string>> = {
  'v-stack': {
    'spacing': 'spacing',
    'alignment': 'alignment',
  },
  'h-stack': {
    'spacing': 'spacing',
    'alignment': 'alignment',
  },
  'text': {
    'font': '.font',
    'font-weight': '.fontWeight',
    'foreground-color': '.foregroundColor',
    'multiline-text-alignment': '.multilineTextAlignment',
    'line-limit': '.lineLimit',
  },
  'button': {
    'role': 'role',
    'button-style': '.buttonStyle',
  },
  'image': {
    'system-name': 'systemName',
    'resizable': '.resizable',
    'aspect-ratio': '.aspectRatio',
  },
  'spatial-window': {
    'title': 'title (param)',
    'id': 'id (param)',
    'default-size': '.defaultSize',
  },
  'model-3d': {
    'named': 'named (param)',
    'bundle': 'bundle (param)',
  },
}

/**
 * 核心 transform：识别元素类型并标注 SwiftUI 映射信息。
 */
export const transformElement: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ELEMENT) return

  return () => {
    const tag = node.tag
    const swiftType = ELEMENT_MAP[tag]

    if (!swiftType) {
      // 未知元素：可能是用户自定义组件，保持原样
      // 后续由组件注册表解析
      context.onWarn({
        message: `未知的空间计算元素 <${tag}>，将尝试作为自定义组件处理`,
        loc: node.loc,
      } as any)
      return
    }

    // 在节点上附加 spatial 元数据
    ;(node as any).__spatialType = swiftType
    ;(node as any).__spatialModifiers = ELEMENT_MODIFIERS[tag] || []
    ;(node as any).__spatialPropMap = PROP_MAP[tag] || {}
  }
}
```

### 3.5 指令编译 — transformDirective.ts

#### 3.5.1 v-if → if/else

```
Vue 模板:
<text v-if="isVisible">可见</text>
<text v-else>不可见</text>

SwiftUI 输出:
if viewModel.isVisible {
    Text("可见")
} else {
    Text("不可见")
}
```

#### 3.5.2 v-for → ForEach

```
Vue 模板:
<text v-for="item in items" :key="item.id">
  {{ item.name }}
</text>

SwiftUI 输出:
ForEach(viewModel.items, id: \.id) { item in
    Text(item.name)
}
```

#### 3.5.3 v-model → @Binding

```
Vue 模板:
<text-field v-model="username" placeholder="用户名" />

SwiftUI 输出:
TextField("用户名", text: $viewModel.username)
```

#### 3.5.4 v-show → .opacity modifier

```
Vue 模板:
<text v-show="isVisible">内容</text>

SwiftUI 输出:
Text("内容")
    .opacity(viewModel.isVisible ? 1 : 0)
```

#### 3.5.5 实现代码

```typescript
// packages/compiler-spatial/src/transforms/transformDirective.ts

import {
  type DirectiveNode,
  type ElementNode,
  NodeTypes,
} from '@vue/compiler-core'
import type { SpatialTransformContext } from '../transform'

/**
 * 指令编译结果。
 * 每个指令可能生成：
 * - wrapper: 包裹当前节点的 Swift 代码（如 if/ForEach）
 * - modifier: 附加到当前节点的 SwiftUI modifier
 * - paramBinding: 替换某个参数为 Binding（如 v-model）
 */
export interface DirectiveCompileResult {
  wrapper?: {
    before: string   // 节点前的代码（如 "if viewModel.xxx {"）
    after: string    // 节点后的代码（如 "}"）
  }
  modifier?: string
  paramBinding?: {
    paramName: string
    expression: string
  }
}

export function compileDirective(
  dir: DirectiveNode,
  node: ElementNode,
  context: SpatialTransformContext,
): DirectiveCompileResult {
  switch (dir.name) {
    case 'if':
      return compileVIf(dir, context)
    case 'else-if':
      return compileVElseIf(dir, context)
    case 'else':
      return compileVElse(context)
    case 'for':
      return compileVFor(dir, context)
    case 'model':
      return compileVModel(dir, node, context)
    case 'show':
      return compileVShow(dir, context)
    default:
      context.onWarn(`不支持的指令 v-${dir.name}，将被忽略`)
      return {}
  }
}

function compileVIf(
  dir: DirectiveNode,
  context: SpatialTransformContext,
): DirectiveCompileResult {
  const exp = resolveExpression(dir, context)
  return {
    wrapper: {
      before: `if ${exp} {`,
      after: `}`,
    },
  }
}

function compileVElseIf(
  dir: DirectiveNode,
  context: SpatialTransformContext,
): DirectiveCompileResult {
  const exp = resolveExpression(dir, context)
  return {
    wrapper: {
      before: `} else if ${exp} {`,
      after: `}`,
    },
  }
}

function compileVElse(
  _context: SpatialTransformContext,
): DirectiveCompileResult {
  return {
    wrapper: {
      before: `} else {`,
      after: `}`,
    },
  }
}

function compileVFor(
  dir: DirectiveNode,
  context: SpatialTransformContext,
): DirectiveCompileResult {
  // v-for="item in items" → ForEach(viewModel.items, id: \.self) { item in
  // v-for="(item, index) in items" → ForEach(Array(viewModel.items.enumerated()), id: \.offset) { index, item in
  const exp = dir.exp?.type === NodeTypes.SIMPLE_EXPRESSION
    ? dir.exp.content
    : ''

  const forMatch = exp.match(
    /^\s*\(?(\w+)(?:\s*,\s*(\w+))?\)?\s+(?:in|of)\s+(.+)\s*$/,
  )
  if (!forMatch) {
    context.onError(`无法解析 v-for 表达式: ${exp}`)
    return {}
  }

  const [, item, index, list] = forMatch
  const listExpr = `viewModel.${list.trim()}`

  // 查找 :key 绑定
  const parentNode = context.currentNode as ElementNode
  const keyProp = parentNode?.props.find(
    p => p.type === NodeTypes.DIRECTIVE && p.name === 'bind' &&
      p.arg?.type === NodeTypes.SIMPLE_EXPRESSION && p.arg.content === 'key',
  )
  const keyPath = keyProp && keyProp.type === NodeTypes.DIRECTIVE &&
    keyProp.exp?.type === NodeTypes.SIMPLE_EXPRESSION
    ? keyProp.exp.content.replace(item + '.', '\\.')
    : '\\.self'

  if (index) {
    return {
      wrapper: {
        before: `ForEach(Array(${listExpr}.enumerated()), id: \\.offset) { ${index}, ${item} in`,
        after: `}`,
      },
    }
  }

  return {
    wrapper: {
      before: `ForEach(${listExpr}, id: ${keyPath}) { ${item} in`,
      after: `}`,
    },
  }
}

function compileVModel(
  dir: DirectiveNode,
  node: ElementNode,
  context: SpatialTransformContext,
): DirectiveCompileResult {
  const exp = resolveExpression(dir, context)
  const tag = node.tag

  // 根据元素类型决定绑定参数名
  const bindingParamMap: Record<string, string> = {
    'text-field': 'text',
    'secure-field': 'text',
    'text-editor': 'text',
    'toggle': 'isOn',
    'slider': 'value',
    'stepper': 'value',
    'picker': 'selection',
    'date-picker': 'selection',
    'color-picker': 'selection',
  }

  const paramName = bindingParamMap[tag] || 'value'

  return {
    paramBinding: {
      paramName,
      expression: `$viewModel.${exp}`,
    },
  }
}

function compileVShow(
  dir: DirectiveNode,
  context: SpatialTransformContext,
): DirectiveCompileResult {
  const exp = resolveExpression(dir, context)
  return {
    modifier: `.opacity(${exp} ? 1 : 0)`,
  }
}

function resolveExpression(
  dir: DirectiveNode,
  context: SpatialTransformContext,
): string {
  if (dir.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
    const raw = dir.exp.content.trim()
    // 将 JS 表达式中的简单标识符添加 viewModel 前缀
    // 复杂表达式需要更详细的 AST 分析
    return prefixIdentifiers(raw, context)
  }
  return 'true'
}

function prefixIdentifiers(
  expr: string,
  context: SpatialTransformContext,
): string {
  // 简单情况：纯标识符
  if (/^\w+$/.test(expr)) {
    if (context.knownGlobals?.has(expr)) return expr
    return `viewModel.${expr}`
  }

  // 比较和逻辑表达式：通过简单的正则替换
  // 完整实现应使用 Babel AST 分析
  return expr.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
    const jsGlobals = new Set([
      'true', 'false', 'null', 'undefined',
      'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean',
      'parseInt', 'parseFloat', 'console',
    ])
    if (jsGlobals.has(match)) return match
    if (context.knownGlobals?.has(match)) return match
    return `viewModel.${match}`
  })
}
```

### 3.6 事件编译 — transformEvent.ts

```typescript
// packages/compiler-spatial/src/transforms/transformEvent.ts

/**
 * 事件名 → SwiftUI 手势/动作的映射。
 */
export const EVENT_MAP: Record<string, EventMapping> = {
  // 标准动作
  'tap': { type: 'action', code: '' },          // Button 的默认 action
  'click': { type: 'action', code: '' },         // 等同于 tap

  // 手势
  'spatial-tap': {
    type: 'gesture',
    code: '.gesture(SpatialTapGesture().onEnded { value in\n  __handler__\n})',
  },
  'drag': {
    type: 'gesture',
    code: '.gesture(DragGesture().onChanged { value in\n  __handler__\n})',
  },
  'long-press': {
    type: 'gesture',
    code: '.gesture(LongPressGesture().onEnded { _ in\n  __handler__\n})',
  },
  'rotate': {
    type: 'gesture',
    code: '.gesture(RotateGesture3D().onChanged { value in\n  __handler__\n})',
  },
  'magnify': {
    type: 'gesture',
    code: '.gesture(MagnifyGesture().onChanged { value in\n  __handler__\n})',
  },

  // 生命周期
  'appear': { type: 'modifier', code: '.onAppear { __handler__ }' },
  'disappear': { type: 'modifier', code: '.onDisappear { __handler__ }' },

  // 变化监听
  'change': { type: 'modifier', code: '.onChange(of: __arg__) { __handler__ }' },
}

interface EventMapping {
  type: 'action' | 'gesture' | 'modifier'
  code: string
}

/**
 * 将 @event 编译为 SwiftUI 代码。
 *
 * 输入: @tap="handleTap"
 * 输出:
 *   - 对于 Button: Button(action: { viewModel.handleTap() }) { ... }
 *   - 对于其他元素: .onTapGesture { viewModel.handleTap() }
 *
 * 输入: @drag="onDrag"
 * 输出: .gesture(DragGesture().onChanged { value in viewModel.onDrag(value) })
 */
export function compileEvent(
  eventName: string,
  handlerExpr: string,
  elementTag: string,
): { actionParam?: string; modifier?: string } {
  const mapping = EVENT_MAP[eventName]

  if (!mapping) {
    return { modifier: `.onTapGesture { viewModel.${handlerExpr}() }` }
  }

  const handler = `viewModel.${handlerExpr}()`

  if (mapping.type === 'action' && elementTag === 'button') {
    return { actionParam: `action: { ${handler} }` }
  }

  if (mapping.type === 'action') {
    return { modifier: `.onTapGesture { ${handler} }` }
  }

  const code = mapping.code.replace('__handler__', handler)
  return { modifier: code }
}
```

### 3.7 样式编译 — transformStyle.ts

```typescript
// packages/compiler-spatial/src/transforms/transformStyle.ts

/**
 * CSS-like 属性 → SwiftUI modifier 映射。
 * <style spatial> 块中使用类 CSS 语法，编译为 SwiftUI modifier 链。
 */
export const STYLE_MODIFIER_MAP: Record<string, ModifierMapping> = {
  // 尺寸
  'width': { modifier: '.frame', param: 'width' },
  'height': { modifier: '.frame', param: 'height' },
  'min-width': { modifier: '.frame', param: 'minWidth' },
  'max-width': { modifier: '.frame', param: 'maxWidth' },
  'min-height': { modifier: '.frame', param: 'minHeight' },
  'max-height': { modifier: '.frame', param: 'maxHeight' },

  // 间距
  'padding': { modifier: '.padding', param: null },
  'padding-top': { modifier: '.padding', param: '.top' },
  'padding-bottom': { modifier: '.padding', param: '.bottom' },
  'padding-leading': { modifier: '.padding', param: '.leading' },
  'padding-trailing': { modifier: '.padding', param: '.trailing' },
  'padding-horizontal': { modifier: '.padding', param: '.horizontal' },
  'padding-vertical': { modifier: '.padding', param: '.vertical' },

  // 外观
  'foreground-color': { modifier: '.foregroundColor', param: null },
  'background': { modifier: '.background', param: null },
  'tint': { modifier: '.tint', param: null },
  'opacity': { modifier: '.opacity', param: null },
  'corner-radius': { modifier: '.cornerRadius', param: null },
  'clip-shape': { modifier: '.clipShape', param: null },
  'shadow': { modifier: '.shadow', param: null },

  // 字体
  'font': { modifier: '.font', param: null },
  'font-weight': { modifier: '.fontWeight', param: null },
  'font-size': { modifier: '.font', param: '.system(size:)' },

  // 布局
  'frame-alignment': { modifier: '.frame', param: 'alignment' },
  'z-index': { modifier: '.zIndex', param: null },

  // 按钮样式
  'button-style': { modifier: '.buttonStyle', param: null },

  // 3D / Spatial
  'rotation-3d': { modifier: '.rotation3DEffect', param: null },
  'offset-z': { modifier: '.offset', param: 'z' },
  'depth': { modifier: '.frame', param: 'depth' },
}

interface ModifierMapping {
  modifier: string
  param: string | null
}

/**
 * SwiftUI 颜色常量映射。
 */
export const COLOR_MAP: Record<string, string> = {
  'primary': '.primary',
  'secondary': '.secondary',
  'accent': '.accentColor',
  'red': '.red',
  'blue': '.blue',
  'green': '.green',
  'orange': '.orange',
  'yellow': '.yellow',
  'purple': '.purple',
  'pink': '.pink',
  'white': '.white',
  'black': '.black',
  'gray': '.gray',
  'clear': '.clear',
}

/**
 * SwiftUI 字体常量映射。
 */
export const FONT_MAP: Record<string, string> = {
  'largeTitle': '.largeTitle',
  'title': '.title',
  'title2': '.title2',
  'title3': '.title3',
  'headline': '.headline',
  'subheadline': '.subheadline',
  'body': '.body',
  'callout': '.callout',
  'footnote': '.footnote',
  'caption': '.caption',
  'caption2': '.caption2',
  'extraLargeTitle': '.extraLargeTitle',
  'extraLargeTitle2': '.extraLargeTitle2',
}

/**
 * 解析 <style spatial> 中的一条规则。
 *
 * 输入:
 *   text {
 *     foreground-color: primary;
 *     font: largeTitle;
 *     padding: 16;
 *   }
 *
 * 输出:
 *   {
 *     selector: 'text',
 *     modifiers: [
 *       '.foregroundColor(.primary)',
 *       '.font(.largeTitle)',
 *       '.padding(16)',
 *     ]
 *   }
 */
export interface SpatialStyleRule {
  selector: string
  modifiers: string[]
}

export function parseSpatialStyleBlock(source: string): SpatialStyleRule[] {
  const rules: SpatialStyleRule[] = []
  const ruleRegex = /([^{]+)\{([^}]+)\}/g
  let match

  while ((match = ruleRegex.exec(source)) !== null) {
    const selector = match[1].trim()
    const body = match[2].trim()
    const modifiers: string[] = []

    const declarations = body.split(';').filter(d => d.trim())
    for (const decl of declarations) {
      const [prop, value] = decl.split(':').map(s => s.trim())
      if (!prop || !value) continue

      const modifier = compileStyleDeclaration(prop, value)
      if (modifier) {
        modifiers.push(modifier)
      }
    }

    rules.push({ selector, modifiers })
  }

  return rules
}

function compileStyleDeclaration(prop: string, value: string): string | null {
  const mapping = STYLE_MODIFIER_MAP[prop]
  if (!mapping) return null

  const resolvedValue = resolveStyleValue(prop, value)

  if (mapping.param === null) {
    return `${mapping.modifier}(${resolvedValue})`
  }

  // frame 等多参数 modifier 需要聚合处理
  return `${mapping.modifier}(${mapping.param}: ${resolvedValue})`
}

function resolveStyleValue(prop: string, value: string): string {
  // 颜色值
  if (prop.includes('color') || prop === 'tint' || prop === 'background') {
    return COLOR_MAP[value] || `Color("${value}")`
  }

  // 字体值
  if (prop === 'font') {
    return FONT_MAP[value] || `.system(size: ${value})`
  }

  // 字体粗细
  if (prop === 'font-weight') {
    return `.${value}`
  }

  // 按钮样式
  if (prop === 'button-style') {
    const styleMap: Record<string, string> = {
      'bordered': '.bordered',
      'borderedProminent': '.borderedProminent',
      'borderless': '.borderless',
      'plain': '.plain',
    }
    return styleMap[value] || `.${value}`
  }

  // 数字值
  if (/^\d+(\.\d+)?$/.test(value)) {
    return value
  }

  // 其他值原样返回
  return `.${value}`
}
```

### 3.8 codegen.ts — SwiftUI 代码生成器

```typescript
// packages/compiler-spatial/src/codegen.ts

import {
  type RootNode,
  type ElementNode,
  type TextNode,
  type InterpolationNode,
  NodeTypes,
} from '@vue/compiler-core'
import type { SpatialCompileOptions } from './options'
import { ELEMENT_MAP, ELEMENT_MODIFIERS } from './transforms/transformElement'
import { compileDirective } from './transforms/transformDirective'
import { compileEvent } from './transforms/transformEvent'

export interface GenerateResult {
  code: string
}

/**
 * 从 AST 生成 SwiftUI 代码。
 *
 * 生成的代码格式：
 *
 * ```swift
 * // Auto-generated by @vue/compiler-spatial
 * // Source: HelloSpatial.vue
 *
 * import SwiftUI
 *
 * struct HelloSpatialView: View {
 *     @ObservedObject var viewModel: VueViewModel
 *
 *     var body: some View {
 *         VStack(spacing: 20) {
 *             Text("\(viewModel.count)")
 *                 .font(.largeTitle)
 *             Button(action: { viewModel.call("increment") }) {
 *                 Text("+1")
 *             }
 *         }
 *     }
 * }
 * ```
 */
export function generate(
  ast: RootNode,
  options: SpatialCompileOptions = {},
): GenerateResult {
  const context = createCodegenContext(options)
  const { push, indent, deindent, newline } = context

  // 文件头
  push(`// Auto-generated by @vue/compiler-spatial`)
  newline()
  push(`// Source: ${options.filename || 'unknown.vue'}`)
  newline()
  push(`// DO NOT EDIT - This file is generated from a Vue spatial component`)
  newline()
  newline()
  push(`import SwiftUI`)
  newline()
  if (options.needsRealityKit) {
    push(`import RealityKit`)
    newline()
  }
  newline()

  // 视图名称
  const viewName = generateViewName(options.filename || 'Component')
  push(`struct ${viewName}: View {`)
  indent()
  newline()

  // ViewModel 引用
  push(`@ObservedObject var viewModel: VueViewModel`)
  newline()
  newline()

  // body
  push(`var body: some View {`)
  indent()
  newline()

  // 遍历 AST 子节点生成视图代码
  for (const child of ast.children) {
    generateNode(child, context)
  }

  deindent()
  newline()
  push(`}`)

  deindent()
  newline()
  push(`}`)
  newline()

  return { code: context.code }
}

// ===== 内部函数 =====

interface CodegenContext {
  code: string
  indentLevel: number
  options: SpatialCompileOptions
  push(code: string): void
  indent(): void
  deindent(): void
  newline(): void
}

function createCodegenContext(
  options: SpatialCompileOptions,
): CodegenContext {
  const context: CodegenContext = {
    code: '',
    indentLevel: 0,
    options,
    push(code) {
      context.code += code
    },
    indent() {
      context.indentLevel++
    },
    deindent() {
      context.indentLevel--
    },
    newline() {
      context.code += '\n' + '    '.repeat(context.indentLevel)
    },
  }
  return context
}

function generateNode(
  node: any,
  context: CodegenContext,
): void {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      generateElement(node as ElementNode, context)
      break
    case NodeTypes.TEXT:
      generateText(node as TextNode, context)
      break
    case NodeTypes.INTERPOLATION:
      generateInterpolation(node as InterpolationNode, context)
      break
    case NodeTypes.IF:
      generateIf(node, context)
      break
    case NodeTypes.FOR:
      generateFor(node, context)
      break
    case NodeTypes.COMMENT:
      context.push(`// ${(node as any).content}`)
      context.newline()
      break
  }
}

function generateElement(
  node: ElementNode,
  context: CodegenContext,
): void {
  const { push, indent, deindent, newline } = context
  const swiftType = ELEMENT_MAP[node.tag] || node.tag
  const modifiers = ELEMENT_MODIFIERS[node.tag] || []

  // 收集属性和事件
  const params: string[] = []
  const postModifiers: string[] = [...modifiers]
  let actionParam: string | null = null

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      // 静态属性
      params.push(`${prop.name}: ${formatSwiftValue(prop.value?.content || '')}`)
    } else if (prop.type === NodeTypes.DIRECTIVE) {
      if (prop.name === 'on') {
        // 事件绑定
        const eventName = prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
          ? prop.arg.content
          : ''
        const handler = prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
          ? prop.exp.content
          : ''
        const result = compileEvent(eventName, handler, node.tag)
        if (result.actionParam) actionParam = result.actionParam
        if (result.modifier) postModifiers.push(result.modifier)
      } else if (prop.name === 'bind') {
        // 动态绑定
        const attrName = prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
          ? prop.arg.content
          : ''
        const expr = prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
          ? prop.exp.content
          : ''
        params.push(`${attrName}: viewModel.${expr}`)
      }
    }
  }

  // 生成 SwiftUI 调用
  const hasChildren = node.children.length > 0
  const paramStr = params.length > 0 ? `(${params.join(', ')})` : ''

  if (actionParam && hasChildren) {
    // Button(action: { ... }) { content }
    push(`${swiftType}(${actionParam}) {`)
  } else if (hasChildren) {
    push(`${swiftType}${paramStr} {`)
  } else {
    push(`${swiftType}${paramStr}`)
  }

  if (hasChildren) {
    indent()
    for (const child of node.children) {
      newline()
      generateNode(child, context)
    }
    deindent()
    newline()
    push(`}`)
  }

  // 附加 modifiers
  for (const mod of postModifiers) {
    newline()
    push(`    ${mod}`)
  }
}

function generateText(node: TextNode, context: CodegenContext): void {
  const content = node.content.trim()
  if (content) {
    context.push(`Text("${escapeSwiftString(content)}")`)
  }
}

function generateInterpolation(
  node: InterpolationNode,
  context: CodegenContext,
): void {
  if (node.content.type === NodeTypes.SIMPLE_EXPRESSION) {
    const expr = node.content.content
    context.push(`Text("\\(viewModel.${expr})")`)
  }
}

function generateIf(node: any, context: CodegenContext): void {
  const { push, indent, deindent, newline } = context

  for (let i = 0; i < node.branches.length; i++) {
    const branch = node.branches[i]
    if (i === 0) {
      // v-if
      const condition = branch.condition?.content || 'true'
      push(`if viewModel.${condition} {`)
    } else if (branch.condition) {
      // v-else-if
      push(`} else if viewModel.${branch.condition.content} {`)
    } else {
      // v-else
      push(`} else {`)
    }
    indent()
    for (const child of branch.children) {
      newline()
      generateNode(child, context)
    }
    deindent()
    newline()
  }
  push(`}`)
}

function generateFor(node: any, context: CodegenContext): void {
  const { push, indent, deindent, newline } = context
  const source = node.source?.content || ''
  const value = node.valueAlias?.content || 'item'

  push(`ForEach(viewModel.${source}, id: \\.self) { ${value} in`)
  indent()
  for (const child of node.children) {
    newline()
    generateNode(child, context)
  }
  deindent()
  newline()
  push(`}`)
}

// ===== 工具函数 =====

function generateViewName(filename: string): string {
  const base = filename
    .replace(/\.vue$/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
  return base.charAt(0).toUpperCase() + base.slice(1) + 'View'
}

function formatSwiftValue(value: string): string {
  if (/^\d+(\.\d+)?$/.test(value)) return value
  if (value === 'true' || value === 'false') return value
  return `"${escapeSwiftString(value)}"`
}

function escapeSwiftString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
}
```

### 3.9 空间场景组件

#### 3.9.1 spatialWindow.ts

```typescript
// packages/compiler-spatial/src/components/spatialWindow.ts

/**
 * <spatial-window> → WindowGroup 场景声明
 *
 * 输入:
 * <spatial-window title="我的窗口" id="main" :default-size="{ width: 800, height: 600 }">
 *   <v-stack>...</v-stack>
 * </spatial-window>
 *
 * 输出（App.swift 片段）:
 * WindowGroup("我的窗口", id: "main") {
 *     ContentView(viewModel: viewModel)
 * }
 * .defaultSize(width: 800, height: 600)
 */
export interface WindowGroupConfig {
  title?: string
  id?: string
  defaultSize?: { width: number; height: number; depth?: number }
}

export function generateWindowGroupScene(config: WindowGroupConfig): string {
  const params: string[] = []
  if (config.title) params.push(`"${config.title}"`)
  if (config.id) params.push(`id: "${config.id}"`)

  let code = `WindowGroup(${params.join(', ')}) {\n`
  code += `    ContentView(viewModel: viewModel)\n`
  code += `}`

  if (config.defaultSize) {
    const { width, height, depth } = config.defaultSize
    let sizeParams = `width: ${width}, height: ${height}`
    if (depth) sizeParams += `, depth: ${depth}`
    code += `\n.defaultSize(${sizeParams})`
  }

  return code
}
```

#### 3.9.2 spatialVolume.ts

```typescript
// packages/compiler-spatial/src/components/spatialVolume.ts

/**
 * <spatial-volume> → WindowGroup + .windowStyle(.volumetric)
 *
 * 输入:
 * <spatial-volume :default-size="{ width: 0.5, height: 0.5, depth: 0.5 }">
 *   <reality-view>...</reality-view>
 * </spatial-volume>
 *
 * 输出:
 * WindowGroup {
 *     VolumetricContentView(viewModel: viewModel)
 * }
 * .windowStyle(.volumetric)
 * .defaultSize(width: 0.5, height: 0.5, depth: 0.5, in: .meters)
 */
export interface VolumetricConfig {
  defaultSize?: { width: number; height: number; depth: number }
  unit?: 'meters' | 'points'
}

export function generateVolumetricScene(config: VolumetricConfig): string {
  let code = `WindowGroup {\n`
  code += `    VolumetricContentView(viewModel: viewModel)\n`
  code += `}\n`
  code += `.windowStyle(.volumetric)`

  if (config.defaultSize) {
    const { width, height, depth } = config.defaultSize
    const unit = config.unit || 'meters'
    code += `\n.defaultSize(width: ${width}, height: ${height}, depth: ${depth}, in: .${unit})`
  }

  return code
}
```

#### 3.9.3 spatialImmersive.ts

```typescript
// packages/compiler-spatial/src/components/spatialImmersive.ts

/**
 * <spatial-immersive> → ImmersiveSpace
 *
 * 输入:
 * <spatial-immersive id="immersive" :immersion-style="mixed">
 *   <reality-view>...</reality-view>
 * </spatial-immersive>
 *
 * 输出:
 * ImmersiveSpace(id: "immersive") {
 *     ImmersiveContentView(viewModel: viewModel)
 * }
 * .immersionStyle(selection: .constant(.mixed), in: .mixed, .full)
 */
export type ImmersionStyle = 'mixed' | 'full' | 'progressive'

export interface ImmersiveConfig {
  id: string
  immersionStyle?: ImmersionStyle
}

export function generateImmersiveScene(config: ImmersiveConfig): string {
  let code = `ImmersiveSpace(id: "${config.id}") {\n`
  code += `    ImmersiveContentView(viewModel: viewModel)\n`
  code += `}`

  if (config.immersionStyle) {
    const style = config.immersionStyle
    code += `\n.immersionStyle(selection: .constant(.${style}), in: .mixed, .full, .progressive)`
  }

  return code
}
```

### 3.10 Slot 编译 — transformSlot.ts

```typescript
// packages/compiler-spatial/src/transforms/transformSlot.ts

/**
 * Vue <slot> → SwiftUI @ViewBuilder 参数
 *
 * 输入:
 * // MyCard.vue
 * <template spatial>
 *   <v-stack>
 *     <slot name="header" />
 *     <slot />
 *     <slot name="footer" />
 *   </v-stack>
 * </template>
 *
 * 输出:
 * struct MyCardView<Header: View, Content: View, Footer: View>: View {
 *     @ObservedObject var viewModel: VueViewModel
 *     @ViewBuilder var header: () -> Header
 *     @ViewBuilder var content: () -> Content
 *     @ViewBuilder var footer: () -> Footer
 *
 *     var body: some View {
 *         VStack {
 *             header()
 *             content()
 *             footer()
 *         }
 *     }
 * }
 */

export interface SlotInfo {
  name: string          // slot 名称，默认为 "default" → "content"
  swiftGenericName: string  // Swift 泛型参数名
  swiftParamName: string    // Swift @ViewBuilder 参数名
}

export function analyzeSlots(ast: any): SlotInfo[] {
  const slots: SlotInfo[] = []
  // 遍历 AST 收集所有 <slot> 节点
  walkSlots(ast, slots)
  return slots
}

function walkSlots(node: any, slots: SlotInfo[]): void {
  if (!node) return

  if (node.tag === 'slot') {
    const name = getSlotName(node)
    const swiftName = name === 'default' ? 'content' : name
    const genericName = capitalize(swiftName)

    if (!slots.find(s => s.name === name)) {
      slots.push({
        name,
        swiftGenericName: genericName,
        swiftParamName: swiftName,
      })
    }
  }

  if (node.children) {
    for (const child of node.children) {
      walkSlots(child, slots)
    }
  }
}

function getSlotName(node: any): string {
  const nameProp = node.props?.find(
    (p: any) => p.name === 'name' && p.type === 6, // NodeTypes.ATTRIBUTE
  )
  return nameProp?.value?.content || 'default'
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
```

---

## 4. runtime-spatial 新包

### 4.1 目录结构

```
packages/runtime-spatial/
  package.json
  src/
    index.ts                         # 公共 API：createSpatialApp、composables
    bridge.ts                        # SpatialBridge IPC 协议实现
    renderer.ts                      # 自定义渲染器（patch → IPC 消息）
    scheduler.ts                     # 按帧批量合并 patch
    nodeOps.ts                       # 空间节点操作（类似 runtime-test/nodeOps）
    patchProp.ts                     # 属性 patch 逻辑
    composables/
      useSpatialGesture.ts           # 空间手势 composable
      useSpatialScene.ts             # 场景管理 composable
      useHandTracking.ts             # 手部追踪 composable
      useSpatialAudio.ts             # 空间音频 composable
      useSceneUnderstanding.ts       # 场景理解 composable
    lifecycle.ts                     # 空间生命周期钩子
    types.ts                         # 全部 TypeScript 类型定义
  __tests__/
    bridge.spec.ts
    renderer.spec.ts
    scheduler.spec.ts
    composables/
```

### 4.2 package.json

```json
{
  "name": "@vue/runtime-spatial",
  "version": "0.1.0",
  "description": "Vue runtime for spatial computing via JavaScriptCore bridge",
  "main": "dist/runtime-spatial.cjs.js",
  "module": "dist/runtime-spatial.esm-bundler.js",
  "types": "dist/runtime-spatial.d.ts",
  "files": ["dist"],
  "buildOptions": {
    "name": "VueRuntimeSpatial",
    "formats": ["esm-bundler", "cjs"]
  },
  "dependencies": {
    "@vue/runtime-core": "workspace:*",
    "@vue/reactivity": "workspace:*",
    "@vue/shared": "workspace:*"
  }
}
```

### 4.3 types.ts — 类型定义

```typescript
// packages/runtime-spatial/src/types.ts

// ===== 桥接消息类型 =====

/**
 * JS → Swift 消息类型枚举。
 */
export enum BridgeMessageType {
  // 节点操作
  CREATE_ELEMENT = 'createElement',
  CREATE_TEXT = 'createText',
  INSERT = 'insert',
  REMOVE = 'remove',
  SET_TEXT = 'setText',
  SET_ELEMENT_TEXT = 'setElementText',
  PATCH_PROP = 'patchProp',

  // 生命周期
  APP_MOUNTED = 'appMounted',
  APP_UNMOUNTED = 'appUnmounted',
  COMPONENT_UPDATED = 'componentUpdated',

  // 方法调用
  CALL_METHOD = 'callMethod',
  EMIT_EVENT = 'emitEvent',

  // 状态同步
  STATE_UPDATE = 'stateUpdate',
  BATCH_UPDATE = 'batchUpdate',

  // 场景管理
  OPEN_WINDOW = 'openWindow',
  CLOSE_WINDOW = 'closeWindow',
  OPEN_IMMERSIVE = 'openImmersive',
  CLOSE_IMMERSIVE = 'closeImmersive',
}

/**
 * Swift → JS 消息类型枚举。
 */
export enum BridgeCallbackType {
  // 用户交互
  GESTURE = 'gesture',
  ACTION = 'action',

  // 生命周期
  SCENE_ACTIVE = 'sceneActive',
  SCENE_INACTIVE = 'sceneInactive',
  SCENE_BACKGROUND = 'sceneBackground',

  // 空间事件
  HAND_TRACKING = 'handTracking',
  SCENE_UNDERSTANDING = 'sceneUnderstanding',
  SPATIAL_AUDIO_EVENT = 'spatialAudioEvent',
  IMMERSIVE_STATE_CHANGED = 'immersiveStateChanged',

  // 系统
  MEMORY_WARNING = 'memoryWarning',
}

/**
 * JS → Swift IPC 消息格式。
 */
export interface BridgeMessage {
  /** 消息唯一标识 */
  id: number
  /** 消息类型 */
  type: BridgeMessageType
  /** 消息负载 */
  payload: Record<string, any>
  /** 时间戳（性能追踪用） */
  timestamp: number
}

/**
 * 批量更新消息。
 * 一帧内的多个 patch 操作会被合并为一个批量消息。
 */
export interface BatchMessage {
  type: BridgeMessageType.BATCH_UPDATE
  messages: BridgeMessage[]
  frameId: number
}

/**
 * Swift → JS 回调消息格式。
 */
export interface BridgeCallback {
  type: BridgeCallbackType
  payload: Record<string, any>
  timestamp: number
}

// ===== 空间节点类型 =====

export enum SpatialNodeType {
  ELEMENT = 'element',
  TEXT = 'text',
  COMMENT = 'comment',
}

export interface SpatialNode {
  id: number
  type: SpatialNodeType
  parentNode: SpatialElement | null
}

export interface SpatialElement extends SpatialNode {
  type: SpatialNodeType.ELEMENT
  tag: string
  props: Record<string, any>
  children: SpatialNode[]
  eventListeners: Record<string, Function | Function[]>
}

export interface SpatialText extends SpatialNode {
  type: SpatialNodeType.TEXT
  text: string
}

export interface SpatialComment extends SpatialNode {
  type: SpatialNodeType.COMMENT
  text: string
}

// ===== Composable 类型 =====

export interface SpatialGestureState {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  scale: number
}

export interface HandJoint {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  isTracked: boolean
}

export interface HandTrackingData {
  left: Record<string, HandJoint>
  right: Record<string, HandJoint>
  timestamp: number
}

export interface SceneAnchor {
  id: string
  type: 'plane' | 'mesh' | 'object'
  transform: Float32Array
  extent?: { width: number; height: number }
  classification?: string
}

export interface SpatialAudioSource {
  id: string
  position: { x: number; y: number; z: number }
  volume: number
  isPlaying: boolean
}

// ===== 生命周期类型 =====

export enum SpatialLifecycle {
  SPATIAL_ENTER = 'spatialEnter',
  SPATIAL_LEAVE = 'spatialLeave',
  IMMERSIVE_ENTER = 'immersiveEnter',
  IMMERSIVE_LEAVE = 'immersiveLeave',
  VOLUME_ENTER = 'volumeEnter',
  VOLUME_LEAVE = 'volumeLeave',
  SCENE_PHASE_CHANGE = 'scenePhaseChange',
}

// ===== App 配置 =====

export interface SpatialAppOptions {
  /**
   * 桥接实例。
   * 在 JavaScriptCore 环境中由 Swift 侧注入。
   */
  bridge?: SpatialBridge

  /**
   * 是否启用 patch 批量优化。
   * @default true
   */
  batchPatches?: boolean

  /**
   * 批量 patch 的最大等待时间（毫秒）。
   * 超过此时间强制刷新。
   * @default 16 (约一帧)
   */
  batchTimeout?: number
}

// 前向声明
export interface SpatialBridge {
  postMessage(message: BridgeMessage | BatchMessage): void
  onCallback(handler: (callback: BridgeCallback) => void): void
  destroy(): void
}
```

### 4.4 bridge.ts — IPC 桥接实现

```typescript
// packages/runtime-spatial/src/bridge.ts

import type {
  BatchMessage,
  BridgeCallback,
  BridgeCallbackType,
  BridgeMessage,
  BridgeMessageType,
  SpatialBridge,
} from './types'

/**
 * SpatialBridge 的 JavaScriptCore 实现。
 *
 * 通信机制：
 * 1. JS → Swift: 通过 JSContext 注入的 __vueSpatialBridge__.postMessage() 函数
 * 2. Swift → JS: Swift 侧调用 JSContext 中注册的 __vueSpatialCallback__() 函数
 *
 * 消息格式：JSON 序列化的 BridgeMessage / BatchMessage
 *
 * 性能考虑：
 * - 所有消息通过 JSON 序列化/反序列化，这是 JSContext 的标准 IPC 方式
 * - 批量更新可将一帧内的多个操作合并为一条消息，减少 IPC 次数
 * - messageId 用于请求-响应关联（未来扩展）
 */
export class SpatialBridgeImpl implements SpatialBridge {
  private messageId = 0
  private callbackHandlers: Map<
    BridgeCallbackType,
    Set<(cb: BridgeCallback) => void>
  > = new Map()
  private globalHandler: ((cb: BridgeCallback) => void) | null = null

  /**
   * __vueSpatialBridge__ 是由 Swift 侧 JSContext.setObject() 注入的原生对象。
   * 它提供 postMessage(jsonString: String) 方法。
   */
  private nativeBridge: {
    postMessage(json: string): void
  }

  constructor() {
    // 获取 Swift 注入的原生桥接对象
    const global = globalThis as any
    if (!global.__vueSpatialBridge__) {
      console.warn(
        '[@vue/runtime-spatial] __vueSpatialBridge__ not found. ' +
        'Running in stub mode (messages will be logged to console).'
      )
      this.nativeBridge = {
        postMessage(json: string) {
          console.log('[SpatialBridge Stub]', json)
        },
      }
    } else {
      this.nativeBridge = global.__vueSpatialBridge__
    }

    // 注册 Swift → JS 回调入口
    global.__vueSpatialCallback__ = (jsonString: string) => {
      try {
        const callback: BridgeCallback = JSON.parse(jsonString)
        this.handleCallback(callback)
      } catch (e) {
        console.error('[@vue/runtime-spatial] Failed to parse callback:', e)
      }
    }
  }

  /**
   * 发送单条消息到 Swift 侧。
   */
  postMessage(message: BridgeMessage | BatchMessage): void {
    const json = JSON.stringify(message)
    this.nativeBridge.postMessage(json)
  }

  /**
   * 创建并发送消息的便捷方法。
   */
  send(type: BridgeMessageType, payload: Record<string, any>): number {
    const id = this.messageId++
    const message: BridgeMessage = {
      id,
      type,
      payload,
      timestamp: Date.now(),
    }
    this.postMessage(message)
    return id
  }

  /**
   * 发送批量更新消息。
   */
  sendBatch(messages: BridgeMessage[], frameId: number): void {
    const batch: BatchMessage = {
      type: 'batchUpdate' as any,
      messages,
      frameId,
    }
    this.postMessage(batch)
  }

  /**
   * 注册全局回调处理器。
   */
  onCallback(handler: (callback: BridgeCallback) => void): void {
    this.globalHandler = handler
  }

  /**
   * 注册特定类型的回调处理器。
   */
  on(type: BridgeCallbackType, handler: (cb: BridgeCallback) => void): void {
    if (!this.callbackHandlers.has(type)) {
      this.callbackHandlers.set(type, new Set())
    }
    this.callbackHandlers.get(type)!.add(handler)
  }

  /**
   * 取消注册特定类型的回调处理器。
   */
  off(type: BridgeCallbackType, handler: (cb: BridgeCallback) => void): void {
    this.callbackHandlers.get(type)?.delete(handler)
  }

  /**
   * 销毁桥接实例，清理回调。
   */
  destroy(): void {
    this.callbackHandlers.clear()
    this.globalHandler = null
    const global = globalThis as any
    delete global.__vueSpatialCallback__
  }

  // ===== 内部方法 =====

  private handleCallback(callback: BridgeCallback): void {
    // 通知全局处理器
    this.globalHandler?.(callback)

    // 通知类型特定处理器
    const handlers = this.callbackHandlers.get(callback.type)
    if (handlers) {
      for (const handler of handlers) {
        handler(callback)
      }
    }
  }
}

/**
 * 创建桥接实例。
 * 应用启动时调用一次。
 */
export function createBridge(): SpatialBridgeImpl {
  return new SpatialBridgeImpl()
}
```

### 4.5 IPC 桥接协议规范

#### 4.5.1 消息流向

```
┌─────────────────────┐                 ┌──────────────────────┐
│   JavaScriptCore    │                 │     Swift/SwiftUI     │
│   (Vue Runtime)     │                 │   (Native Runtime)    │
│                     │                 │                       │
│  vue reactivity ──► │  postMessage()  │                       │
│  patch operations   │ ─────JSON────►  │  VueSpatialRuntime    │
│                     │                 │  ├─ decode message    │
│                     │                 │  ├─ update ViewModel  │
│                     │                 │  └─ SwiftUI re-render │
│                     │                 │                       │
│  event handlers  ◄──│  callback()     │  user interaction     │
│  composable state   │ ◄────JSON─────  │  sensor data          │
│                     │                 │  scene events          │
└─────────────────────┘                 └──────────────────────┘
```

#### 4.5.2 消息格式详细定义

**创建元素消息：**
```json
{
  "id": 1,
  "type": "createElement",
  "payload": {
    "nodeId": 100,
    "tag": "v-stack",
    "props": {
      "spacing": 20,
      "alignment": "center"
    }
  },
  "timestamp": 1700000000000
}
```

**插入节点消息：**
```json
{
  "id": 2,
  "type": "insert",
  "payload": {
    "nodeId": 100,
    "parentId": 1,
    "anchorId": null
  },
  "timestamp": 1700000000001
}
```

**属性更新消息：**
```json
{
  "id": 3,
  "type": "patchProp",
  "payload": {
    "nodeId": 100,
    "key": "spacing",
    "prevValue": 20,
    "nextValue": 30
  },
  "timestamp": 1700000000002
}
```

**状态同步消息：**
```json
{
  "id": 4,
  "type": "stateUpdate",
  "payload": {
    "path": "count",
    "value": 42,
    "type": "number"
  },
  "timestamp": 1700000000003
}
```

**批量更新消息：**
```json
{
  "type": "batchUpdate",
  "frameId": 1,
  "messages": [
    { "id": 5, "type": "patchProp", "payload": { "nodeId": 100, "key": "spacing", "prevValue": 20, "nextValue": 30 }, "timestamp": 1700000000010 },
    { "id": 6, "type": "setText", "payload": { "nodeId": 101, "text": "43" }, "timestamp": 1700000000011 },
    { "id": 7, "type": "patchProp", "payload": { "nodeId": 102, "key": "opacity", "prevValue": 1, "nextValue": 0 }, "timestamp": 1700000000012 }
  ]
}
```

**手势回调：**
```json
{
  "type": "gesture",
  "payload": {
    "gestureType": "spatialTap",
    "nodeId": 100,
    "position": { "x": 0.5, "y": 0.3, "z": -1.0 },
    "timestamp": 1700000000100
  },
  "timestamp": 1700000000100
}
```

**手部追踪回调：**
```json
{
  "type": "handTracking",
  "payload": {
    "left": {
      "wrist": { "position": { "x": -0.2, "y": 0.8, "z": -0.3 }, "rotation": { "x": 0, "y": 0, "z": 0, "w": 1 }, "isTracked": true },
      "indexTip": { "position": { "x": -0.15, "y": 0.9, "z": -0.25 }, "rotation": { "x": 0, "y": 0, "z": 0, "w": 1 }, "isTracked": true }
    },
    "right": {},
    "timestamp": 1700000000200
  },
  "timestamp": 1700000000200
}
```

### 4.6 renderer.ts — 自定义渲染器

本渲染器参照 `packages/runtime-test/src/index.ts` 的模式，使用 `createRenderer` API 创建：

```typescript
// packages/runtime-spatial/src/renderer.ts

import {
  type CreateAppFunction,
  type RootRenderFunction,
  createRenderer,
} from '@vue/runtime-core'
import { extend } from '@vue/shared'
import { nodeOps, type SpatialElement } from './nodeOps'
import { patchProp } from './patchProp'

/**
 * 创建空间计算渲染器。
 *
 * 与 runtime-test 的关键区别：
 * 1. 节点操作通过 IPC 桥接发送到 Swift 侧
 * 2. 属性 patch 会被批量化，按帧合并
 * 3. 事件回调通过桥接从 Swift 侧接收
 */
const { render: baseRender, createApp: baseCreateApp } = createRenderer(
  extend({ patchProp }, nodeOps),
)

export const render = baseRender as RootRenderFunction<SpatialElement>
export const createApp = baseCreateApp as CreateAppFunction<SpatialElement>
```

### 4.7 nodeOps.ts — 节点操作

```typescript
// packages/runtime-spatial/src/nodeOps.ts

import { markRaw } from '@vue/reactivity'
import {
  type SpatialElement,
  type SpatialText,
  type SpatialComment,
  type SpatialNode,
  SpatialNodeType,
  BridgeMessageType,
} from './types'
import { getBridge } from './bridge'

let nodeId = 0

/**
 * 空间节点操作。
 *
 * 每个操作同时完成两件事：
 * 1. 在 JS 侧维护虚拟节点树（用于 Vue 的 diff 算法）
 * 2. 通过桥接发送操作消息到 Swift 侧（用于驱动 SwiftUI 更新）
 *
 * 此设计与 runtime-test 的 nodeOps 结构完全一致，
 * 参见 packages/runtime-test/src/nodeOps.ts
 */

function createElement(tag: string): SpatialElement {
  const node: SpatialElement = {
    id: nodeId++,
    type: SpatialNodeType.ELEMENT,
    tag,
    props: {},
    children: [],
    parentNode: null,
    eventListeners: {},
  }

  // 通知 Swift 侧
  getBridge()?.send(BridgeMessageType.CREATE_ELEMENT, {
    nodeId: node.id,
    tag,
    props: {},
  })

  markRaw(node)
  return node
}

function createText(text: string): SpatialText {
  const node: SpatialText = {
    id: nodeId++,
    type: SpatialNodeType.TEXT,
    text,
    parentNode: null,
  }

  getBridge()?.send(BridgeMessageType.CREATE_TEXT, {
    nodeId: node.id,
    text,
  })

  markRaw(node)
  return node
}

function createComment(text: string): SpatialComment {
  const node: SpatialComment = {
    id: nodeId++,
    type: SpatialNodeType.COMMENT,
    text,
    parentNode: null,
  }

  markRaw(node)
  return node
}

function setText(node: SpatialText, text: string): void {
  node.text = text
  getBridge()?.send(BridgeMessageType.SET_TEXT, {
    nodeId: node.id,
    text,
  })
}

function setElementText(el: SpatialElement, text: string): void {
  el.children.forEach(c => { c.parentNode = null })
  if (!text) {
    el.children = []
  } else {
    const textNode = createText(text)
    textNode.parentNode = el
    el.children = [textNode]
  }

  getBridge()?.send(BridgeMessageType.SET_ELEMENT_TEXT, {
    nodeId: el.id,
    text,
  })
}

function insert(
  child: SpatialNode,
  parent: SpatialElement,
  anchor?: SpatialNode | null,
): void {
  remove(child, false)

  const refIndex = anchor
    ? parent.children.indexOf(anchor)
    : -1

  if (refIndex === -1) {
    parent.children.push(child)
  } else {
    parent.children.splice(refIndex, 0, child)
  }
  child.parentNode = parent

  getBridge()?.send(BridgeMessageType.INSERT, {
    nodeId: child.id,
    parentId: parent.id,
    anchorId: anchor?.id ?? null,
  })
}

function remove(child: SpatialNode, notify = true): void {
  const parent = child.parentNode
  if (parent) {
    const i = (parent as SpatialElement).children.indexOf(child)
    if (i > -1) {
      (parent as SpatialElement).children.splice(i, 1)
    }
    child.parentNode = null

    if (notify) {
      getBridge()?.send(BridgeMessageType.REMOVE, {
        nodeId: child.id,
      })
    }
  }
}

function parentNode(node: SpatialNode): SpatialElement | null {
  return node.parentNode
}

function nextSibling(node: SpatialNode): SpatialNode | null {
  const parent = node.parentNode
  if (!parent) return null
  const children = (parent as SpatialElement).children
  const i = children.indexOf(node)
  return children[i + 1] || null
}

function querySelector(): never {
  throw new Error('querySelector is not supported in spatial renderer.')
}

function setScopeId(el: SpatialElement, id: string): void {
  el.props[id] = ''
}

export const nodeOps = {
  insert,
  remove: (child: SpatialNode) => remove(child, true),
  createElement,
  createText,
  createComment,
  setText,
  setElementText,
  parentNode,
  nextSibling,
  querySelector,
  setScopeId,
}
```

### 4.8 scheduler.ts — 帧批量调度器

```typescript
// packages/runtime-spatial/src/scheduler.ts

import type { BridgeMessage, SpatialBridge } from './types'
import { BridgeMessageType } from './types'

/**
 * 帧批量调度器。
 *
 * 将一帧（约 16ms）内的所有 patch 操作收集起来，
 * 合并为一个 BatchMessage 发送，减少 IPC 次数。
 *
 * visionOS 的目标帧率为 90fps（约 11ms/帧），
 * 因此默认批量窗口设为 11ms。
 */
export class SpatialScheduler {
  private pendingMessages: BridgeMessage[] = []
  private frameId = 0
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private bridge: SpatialBridge

  constructor(
    bridge: SpatialBridge,
    private batchTimeout: number = 11,
  ) {
    this.bridge = bridge
  }

  /**
   * 将消息加入待发送队列。
   * 如果当前没有挂起的 flush，启动计时器。
   */
  enqueue(message: BridgeMessage): void {
    this.pendingMessages.push(message)

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.batchTimeout)
    }
  }

  /**
   * 立即刷新所有挂起的消息。
   * 用于关键操作（如组件挂载完成）。
   */
  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    if (this.pendingMessages.length === 0) return

    const messages = this.pendingMessages
    this.pendingMessages = []
    this.frameId++

    if (messages.length === 1) {
      // 只有一条消息时直接发送，避免批量包装开销
      this.bridge.postMessage(messages[0])
    } else {
      this.bridge.postMessage({
        type: BridgeMessageType.BATCH_UPDATE,
        messages,
        frameId: this.frameId,
      })
    }
  }

  /**
   * 销毁调度器。
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.pendingMessages = []
  }
}
```

### 4.9 index.ts — 公共 API

```typescript
// packages/runtime-spatial/src/index.ts

import { createApp as baseCreateApp } from './renderer'
import { createBridge, SpatialBridgeImpl } from './bridge'
import { SpatialScheduler } from './scheduler'
import type { SpatialAppOptions, SpatialElement } from './types'
import type { App, Component } from '@vue/runtime-core'
import { nodeOps } from './nodeOps'

// ===== 全局桥接实例 =====
let _bridge: SpatialBridgeImpl | null = null
let _scheduler: SpatialScheduler | null = null

export function getBridge(): SpatialBridgeImpl | null {
  return _bridge
}

export function getScheduler(): SpatialScheduler | null {
  return _scheduler
}

// ===== createSpatialApp =====

/**
 * 创建空间计算 Vue 应用实例。
 *
 * 用法:
 * ```ts
 * import { createSpatialApp } from '@vue/runtime-spatial'
 * import App from './App.vue'
 *
 * const app = createSpatialApp(App)
 * app.mount()
 * ```
 *
 * 在 JavaScriptCore 环境中，mount() 不需要传入 DOM 容器，
 * 而是创建一个虚拟根节点并通过桥接通知 Swift 侧。
 */
export function createSpatialApp(
  rootComponent: Component,
  options: SpatialAppOptions = {},
): App<SpatialElement> {
  // 初始化桥接
  _bridge = (options.bridge as SpatialBridgeImpl) || createBridge()

  // 初始化调度器
  if (options.batchPatches !== false) {
    _scheduler = new SpatialScheduler(
      _bridge,
      options.batchTimeout ?? 11,
    )
  }

  // 创建虚拟根容器
  const root = nodeOps.createElement('spatial-root')

  // 创建 Vue 应用
  const app = baseCreateApp(rootComponent)

  // 代理 mount
  const originalMount = app.mount
  app.mount = () => {
    const instance = originalMount(root)

    // 通知 Swift 侧应用已挂载
    _bridge?.send('appMounted' as any, {
      rootId: root.id,
    })

    // 立即刷新所有挂起的操作
    _scheduler?.flush()

    return instance
  }

  // 代理 unmount
  const originalUnmount = app.unmount
  app.unmount = () => {
    _bridge?.send('appUnmounted' as any, {})
    originalUnmount()
    _scheduler?.destroy()
    _bridge?.destroy()
    _bridge = null
    _scheduler = null
  }

  return app
}

// ===== Composables =====
export { useSpatialGesture } from './composables/useSpatialGesture'
export { useSpatialScene } from './composables/useSpatialScene'
export { useHandTracking } from './composables/useHandTracking'
export { useSpatialAudio } from './composables/useSpatialAudio'
export { useSceneUnderstanding } from './composables/useSceneUnderstanding'

// ===== 生命周期钩子 =====
export {
  onSpatialEnter,
  onSpatialLeave,
  onImmersiveEnter,
  onImmersiveLeave,
  onVolumeEnter,
  onVolumeLeave,
} from './lifecycle'

// ===== 重新导出 =====
export * from '@vue/runtime-core'
export type * from './types'
```

### 4.10 响应式与 SwiftUI 状态的连接

```
Vue 响应式系统                              SwiftUI 状态系统
┌──────────────────┐                      ┌─────────────────────┐
│  ref(0)          │                      │  @Published count   │
│    │             │                      │    │                │
│    ▼             │                      │    ▼                │
│  effect 触发     │   IPC stateUpdate    │  VueViewModel       │
│  watcher 执行    │ ──────────────────►  │  (ObservableObject) │
│    │             │                      │    │                │
│    ▼             │                      │    ▼                │
│  scheduler 收集  │                      │  SwiftUI body 重新  │
│  patch 操作      │                      │  计算并渲染          │
│    │             │                      │                     │
│    ▼             │                      │                     │
│  桥接 batch 发送 │                      │                     │
└──────────────────┘                      └─────────────────────┘

                    ◄───── 用户交互 ─────
                    gesture/action callback

手势/动作事件从 SwiftUI 通过回调传回 JS 侧，
触发事件处理函数修改 ref 值，
再次触发 effect → patch → IPC → SwiftUI 更新，
形成完整的响应式闭环。
```

### 4.11 Composables 实现

#### 4.11.1 useSpatialGesture

```typescript
// packages/runtime-spatial/src/composables/useSpatialGesture.ts

import { ref, onMounted, onUnmounted } from '@vue/runtime-core'
import { getBridge } from '../index'
import { BridgeCallbackType } from '../types'
import type { SpatialGestureState, BridgeCallback } from '../types'

/**
 * 空间手势 composable。
 *
 * 提供对 visionOS 空间手势的响应式监听。
 *
 * 用法:
 * ```ts
 * const { tapPosition, isDragging, dragDelta, onTap, onDrag } = useSpatialGesture()
 *
 * onTap((position) => {
 *   console.log('用户在空间中点击了:', position)
 * })
 * ```
 */
export function useSpatialGesture() {
  const tapPosition = ref<{ x: number; y: number; z: number } | null>(null)
  const isDragging = ref(false)
  const dragDelta = ref({ x: 0, y: 0, z: 0 })
  const gestureState = ref<SpatialGestureState>({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: 1,
  })

  type GestureHandler = (state: SpatialGestureState) => void
  const tapHandlers: GestureHandler[] = []
  const dragHandlers: GestureHandler[] = []

  function handleCallback(callback: BridgeCallback) {
    if (callback.type !== BridgeCallbackType.GESTURE) return

    const { gestureType, position, rotation, scale } = callback.payload

    gestureState.value = {
      position: position || gestureState.value.position,
      rotation: rotation || gestureState.value.rotation,
      scale: scale ?? gestureState.value.scale,
    }

    switch (gestureType) {
      case 'spatialTap':
        tapPosition.value = position
        tapHandlers.forEach(h => h(gestureState.value))
        break
      case 'drag':
        isDragging.value = true
        dragDelta.value = position
        dragHandlers.forEach(h => h(gestureState.value))
        break
      case 'dragEnd':
        isDragging.value = false
        break
    }
  }

  onMounted(() => {
    getBridge()?.on(BridgeCallbackType.GESTURE, handleCallback)
  })

  onUnmounted(() => {
    getBridge()?.off(BridgeCallbackType.GESTURE, handleCallback)
  })

  return {
    tapPosition,
    isDragging,
    dragDelta,
    gestureState,
    onTap: (handler: GestureHandler) => { tapHandlers.push(handler) },
    onDrag: (handler: GestureHandler) => { dragHandlers.push(handler) },
  }
}
```

#### 4.11.2 useHandTracking

```typescript
// packages/runtime-spatial/src/composables/useHandTracking.ts

import { ref, readonly, onMounted, onUnmounted } from '@vue/runtime-core'
import { getBridge } from '../index'
import { BridgeCallbackType } from '../types'
import type { HandTrackingData, HandJoint, BridgeCallback } from '../types'

/**
 * 手部追踪 composable。
 *
 * 提供对 visionOS ARKit 手部追踪数据的响应式访问。
 *
 * 用法:
 * ```ts
 * const { leftHand, rightHand, isTracking } = useHandTracking()
 *
 * watchEffect(() => {
 *   if (isTracking.value) {
 *     const indexTip = leftHand.value?.indexTip
 *     if (indexTip?.isTracked) {
 *       console.log('左手食指位置:', indexTip.position)
 *     }
 *   }
 * })
 * ```
 *
 * 注意：手部追踪需要在 Info.plist 中声明
 * NSHandTrackingUsageDescription 权限。
 */
export function useHandTracking() {
  const leftHand = ref<Record<string, HandJoint>>({})
  const rightHand = ref<Record<string, HandJoint>>({})
  const isTracking = ref(false)
  const lastTimestamp = ref(0)

  function handleCallback(callback: BridgeCallback) {
    if (callback.type !== BridgeCallbackType.HAND_TRACKING) return

    const data = callback.payload as HandTrackingData
    leftHand.value = data.left
    rightHand.value = data.right
    lastTimestamp.value = data.timestamp
    isTracking.value = Object.keys(data.left).length > 0 ||
                       Object.keys(data.right).length > 0
  }

  onMounted(() => {
    getBridge()?.on(BridgeCallbackType.HAND_TRACKING, handleCallback)
  })

  onUnmounted(() => {
    getBridge()?.off(BridgeCallbackType.HAND_TRACKING, handleCallback)
  })

  return {
    leftHand: readonly(leftHand),
    rightHand: readonly(rightHand),
    isTracking: readonly(isTracking),
    lastTimestamp: readonly(lastTimestamp),
  }
}
```

#### 4.11.3 useSpatialScene

```typescript
// packages/runtime-spatial/src/composables/useSpatialScene.ts

import { ref, readonly, onMounted, onUnmounted } from '@vue/runtime-core'
import { getBridge } from '../index'
import { BridgeMessageType, BridgeCallbackType } from '../types'
import type { BridgeCallback } from '../types'

/**
 * 场景管理 composable。
 *
 * 提供对 visionOS 窗口和沉浸式空间的管理能力。
 *
 * 用法:
 * ```ts
 * const { openWindow, closeWindow, openImmersive, closeImmersive, scenePhase } = useSpatialScene()
 *
 * async function enterImmersive() {
 *   await openImmersive('immersive-view')
 * }
 * ```
 */
export function useSpatialScene() {
  const scenePhase = ref<'active' | 'inactive' | 'background'>('active')
  const isImmersive = ref(false)

  function handleCallback(callback: BridgeCallback) {
    switch (callback.type) {
      case BridgeCallbackType.SCENE_ACTIVE:
        scenePhase.value = 'active'
        break
      case BridgeCallbackType.SCENE_INACTIVE:
        scenePhase.value = 'inactive'
        break
      case BridgeCallbackType.SCENE_BACKGROUND:
        scenePhase.value = 'background'
        break
      case BridgeCallbackType.IMMERSIVE_STATE_CHANGED:
        isImmersive.value = callback.payload.isActive
        break
    }
  }

  onMounted(() => {
    getBridge()?.on(BridgeCallbackType.SCENE_ACTIVE, handleCallback)
    getBridge()?.on(BridgeCallbackType.SCENE_INACTIVE, handleCallback)
    getBridge()?.on(BridgeCallbackType.SCENE_BACKGROUND, handleCallback)
    getBridge()?.on(BridgeCallbackType.IMMERSIVE_STATE_CHANGED, handleCallback)
  })

  onUnmounted(() => {
    getBridge()?.off(BridgeCallbackType.SCENE_ACTIVE, handleCallback)
    getBridge()?.off(BridgeCallbackType.SCENE_INACTIVE, handleCallback)
    getBridge()?.off(BridgeCallbackType.SCENE_BACKGROUND, handleCallback)
    getBridge()?.off(BridgeCallbackType.IMMERSIVE_STATE_CHANGED, handleCallback)
  })

  function openWindow(id: string) {
    getBridge()?.send(BridgeMessageType.OPEN_WINDOW, { windowId: id })
  }

  function closeWindow(id: string) {
    getBridge()?.send(BridgeMessageType.CLOSE_WINDOW, { windowId: id })
  }

  function openImmersive(id: string) {
    getBridge()?.send(BridgeMessageType.OPEN_IMMERSIVE, { spaceId: id })
  }

  function closeImmersive() {
    getBridge()?.send(BridgeMessageType.CLOSE_IMMERSIVE, {})
  }

  return {
    scenePhase: readonly(scenePhase),
    isImmersive: readonly(isImmersive),
    openWindow,
    closeWindow,
    openImmersive,
    closeImmersive,
  }
}
```

#### 4.11.4 useSpatialAudio

```typescript
// packages/runtime-spatial/src/composables/useSpatialAudio.ts

import { ref, reactive, onUnmounted } from '@vue/runtime-core'
import { getBridge } from '../index'
import { BridgeMessageType } from '../types'
import type { SpatialAudioSource } from '../types'

/**
 * 空间音频 composable。
 *
 * 提供在 3D 空间中定位音源的能力。
 *
 * 用法:
 * ```ts
 * const { createSource, play, setPosition } = useSpatialAudio()
 *
 * const bgm = createSource('background-music', {
 *   position: { x: 0, y: 1.5, z: -2 },
 *   volume: 0.8,
 * })
 *
 * play(bgm.id)
 * ```
 */
export function useSpatialAudio() {
  const sources = reactive<Map<string, SpatialAudioSource>>(new Map())

  function createSource(
    id: string,
    options: {
      position?: { x: number; y: number; z: number }
      volume?: number
      url?: string
    } = {},
  ): SpatialAudioSource {
    const source: SpatialAudioSource = {
      id,
      position: options.position || { x: 0, y: 0, z: 0 },
      volume: options.volume ?? 1.0,
      isPlaying: false,
    }
    sources.set(id, source)

    getBridge()?.send(BridgeMessageType.CALL_METHOD, {
      method: 'createAudioSource',
      args: { id, ...options },
    })

    return source
  }

  function play(id: string) {
    const source = sources.get(id)
    if (source) {
      source.isPlaying = true
      getBridge()?.send(BridgeMessageType.CALL_METHOD, {
        method: 'playAudio',
        args: { id },
      })
    }
  }

  function pause(id: string) {
    const source = sources.get(id)
    if (source) {
      source.isPlaying = false
      getBridge()?.send(BridgeMessageType.CALL_METHOD, {
        method: 'pauseAudio',
        args: { id },
      })
    }
  }

  function setPosition(id: string, pos: { x: number; y: number; z: number }) {
    const source = sources.get(id)
    if (source) {
      source.position = pos
      getBridge()?.send(BridgeMessageType.CALL_METHOD, {
        method: 'setAudioPosition',
        args: { id, position: pos },
      })
    }
  }

  onUnmounted(() => {
    for (const [id] of sources) {
      pause(id)
    }
    sources.clear()
  })

  return { sources, createSource, play, pause, setPosition }
}
```

#### 4.11.5 useSceneUnderstanding

```typescript
// packages/runtime-spatial/src/composables/useSceneUnderstanding.ts

import { ref, readonly, onMounted, onUnmounted } from '@vue/runtime-core'
import { getBridge } from '../index'
import { BridgeCallbackType } from '../types'
import type { SceneAnchor, BridgeCallback } from '../types'

/**
 * 场景理解 composable。
 *
 * 提供对 visionOS ARKit 场景理解数据的响应式访问。
 * 包括平面检测、网格重建、物体识别等。
 *
 * 用法:
 * ```ts
 * const { planes, meshes, objects } = useSceneUnderstanding()
 *
 * watchEffect(() => {
 *   for (const plane of planes.value) {
 *     if (plane.classification === 'table') {
 *       console.log('检测到桌面:', plane.extent)
 *     }
 *   }
 * })
 * ```
 *
 * 注意：场景理解需要在 Info.plist 中声明
 * NSWorldSensingUsageDescription 权限。
 */
export function useSceneUnderstanding() {
  const planes = ref<SceneAnchor[]>([])
  const meshes = ref<SceneAnchor[]>([])
  const objects = ref<SceneAnchor[]>([])
  const isAvailable = ref(false)

  function handleCallback(callback: BridgeCallback) {
    if (callback.type !== BridgeCallbackType.SCENE_UNDERSTANDING) return

    const { anchors } = callback.payload
    if (!anchors) return

    const newPlanes: SceneAnchor[] = []
    const newMeshes: SceneAnchor[] = []
    const newObjects: SceneAnchor[] = []

    for (const anchor of anchors as SceneAnchor[]) {
      switch (anchor.type) {
        case 'plane':
          newPlanes.push(anchor)
          break
        case 'mesh':
          newMeshes.push(anchor)
          break
        case 'object':
          newObjects.push(anchor)
          break
      }
    }

    planes.value = newPlanes
    meshes.value = newMeshes
    objects.value = newObjects
    isAvailable.value = true
  }

  onMounted(() => {
    getBridge()?.on(BridgeCallbackType.SCENE_UNDERSTANDING, handleCallback)
  })

  onUnmounted(() => {
    getBridge()?.off(BridgeCallbackType.SCENE_UNDERSTANDING, handleCallback)
  })

  return {
    planes: readonly(planes),
    meshes: readonly(meshes),
    objects: readonly(objects),
    isAvailable: readonly(isAvailable),
  }
}
```

### 4.12 lifecycle.ts — 空间生命周期钩子

```typescript
// packages/runtime-spatial/src/lifecycle.ts

import { onMounted, onUnmounted } from '@vue/runtime-core'
import { getBridge } from './index'
import { BridgeCallbackType, SpatialLifecycle } from './types'
import type { BridgeCallback } from './types'

type LifecycleHook = () => void

/**
 * 注册空间生命周期钩子的工厂函数。
 */
function createSpatialLifecycleHook(
  lifecycle: SpatialLifecycle,
  callbackType: BridgeCallbackType,
) {
  return (hook: LifecycleHook) => {
    const handler = (cb: BridgeCallback) => {
      if (cb.payload?.lifecycle === lifecycle) {
        hook()
      }
    }

    onMounted(() => {
      getBridge()?.on(callbackType, handler)
    })

    onUnmounted(() => {
      getBridge()?.off(callbackType, handler)
    })
  }
}

/**
 * 组件进入空间场景（窗口显示）时触发。
 *
 * 对应 SwiftUI 的 .onAppear，
 * 但仅在组件首次进入空间渲染时触发。
 */
export const onSpatialEnter = createSpatialLifecycleHook(
  SpatialLifecycle.SPATIAL_ENTER,
  BridgeCallbackType.SCENE_ACTIVE,
)

/**
 * 组件离开空间场景（窗口关闭）时触发。
 */
export const onSpatialLeave = createSpatialLifecycleHook(
  SpatialLifecycle.SPATIAL_LEAVE,
  BridgeCallbackType.SCENE_INACTIVE,
)

/**
 * 进入沉浸式空间时触发。
 */
export const onImmersiveEnter = createSpatialLifecycleHook(
  SpatialLifecycle.IMMERSIVE_ENTER,
  BridgeCallbackType.IMMERSIVE_STATE_CHANGED,
)

/**
 * 离开沉浸式空间时触发。
 */
export const onImmersiveLeave = createSpatialLifecycleHook(
  SpatialLifecycle.IMMERSIVE_LEAVE,
  BridgeCallbackType.IMMERSIVE_STATE_CHANGED,
)

/**
 * 进入体积窗口时触发。
 */
export const onVolumeEnter = createSpatialLifecycleHook(
  SpatialLifecycle.VOLUME_ENTER,
  BridgeCallbackType.SCENE_ACTIVE,
)

/**
 * 离开体积窗口时触发。
 */
export const onVolumeLeave = createSpatialLifecycleHook(
  SpatialLifecycle.VOLUME_LEAVE,
  BridgeCallbackType.SCENE_INACTIVE,
)
```

---

## 5. Swift 侧模板

以下是需要生成或作为模板提供的 Swift 侧代码。这些文件是 visionOS 项目的一部分，由构建工具生成或作为 SDK 的一部分分发。

### 5.1 VueViewModel.swift

```swift
// VueViewModel.swift
// Vue Spatial Computing 的核心桥接 ViewModel。
// 作为 SwiftUI 的 ObservableObject，接收来自 JS 的状态更新并驱动视图刷新。

import SwiftUI
import Combine

@MainActor
class VueViewModel: ObservableObject {
    /// 动态状态存储。
    /// 所有从 JS 侧同步的状态都存储在此字典中。
    /// 通过 @Published 触发 SwiftUI 视图更新。
    @Published var state: [String: AnyCodable] = [:]

    /// 节点树。
    /// 维护从 JS 侧同步的虚拟节点树结构。
    @Published var nodeTree: SpatialNodeTree = SpatialNodeTree()

    /// JS 运行时引用。
    private weak var runtime: VueSpatialRuntime?

    init(runtime: VueSpatialRuntime) {
        self.runtime = runtime
    }

    // MARK: - State Access

    /// 获取状态值（用于 SwiftUI 绑定）。
    func get<T>(_ key: String, default defaultValue: T) -> T {
        return (state[key]?.value as? T) ?? defaultValue
    }

    /// 获取 Binding（用于 v-model 编译输出）。
    func binding<T>(for key: String, default defaultValue: T) -> Binding<T> {
        Binding(
            get: { self.get(key, default: defaultValue) },
            set: { newValue in
                self.state[key] = AnyCodable(newValue)
                // 通知 JS 侧状态变更
                self.runtime?.notifyStateChange(key: key, value: newValue)
            }
        )
    }

    /// 动态属性访问（通过 @dynamicMemberLookup 支持）。
    subscript(key: String) -> Any? {
        get { state[key]?.value }
        set {
            state[key] = newValue.map { AnyCodable($0) }
            objectWillChange.send()
        }
    }

    // MARK: - Method Calls

    /// 调用 JS 侧方法。
    /// 当 SwiftUI 中的按钮 action 触发时调用。
    func call(_ methodName: String, args: [Any] = []) {
        runtime?.callJSMethod(methodName, args: args)
    }

    // MARK: - Bridge Message Processing

    /// 处理来自 JS 侧的状态更新。
    func handleStateUpdate(path: String, value: Any) {
        state[path] = AnyCodable(value)
    }

    /// 处理批量更新。
    func handleBatchUpdate(messages: [[String: Any]]) {
        for message in messages {
            guard let type = message["type"] as? String else { continue }

            switch type {
            case "stateUpdate":
                if let payload = message["payload"] as? [String: Any],
                   let path = payload["path"] as? String,
                   let value = payload["value"] {
                    handleStateUpdate(path: path, value: value)
                }
            case "patchProp":
                if let payload = message["payload"] as? [String: Any] {
                    nodeTree.patchProp(payload)
                }
            case "insert":
                if let payload = message["payload"] as? [String: Any] {
                    nodeTree.insert(payload)
                }
            case "remove":
                if let payload = message["payload"] as? [String: Any] {
                    nodeTree.remove(payload)
                }
            default:
                break
            }
        }
    }
}

// MARK: - Helper Types

/// 类型擦除的可编码值容器。
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intVal = try? container.decode(Int.self) {
            value = intVal
        } else if let doubleVal = try? container.decode(Double.self) {
            value = doubleVal
        } else if let boolVal = try? container.decode(Bool.self) {
            value = boolVal
        } else if let stringVal = try? container.decode(String.self) {
            value = stringVal
        } else if let arrayVal = try? container.decode([AnyCodable].self) {
            value = arrayVal.map { $0.value }
        } else if let dictVal = try? container.decode([String: AnyCodable].self) {
            value = dictVal.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let intVal as Int: try container.encode(intVal)
        case let doubleVal as Double: try container.encode(doubleVal)
        case let boolVal as Bool: try container.encode(boolVal)
        case let stringVal as String: try container.encode(stringVal)
        default: try container.encodeNil()
        }
    }
}

/// 空间节点树。
/// 维护与 JS 侧 nodeOps 对应的节点结构。
class SpatialNodeTree: ObservableObject {
    @Published var nodes: [Int: SpatialNodeInfo] = [:]
    @Published var rootId: Int?

    struct SpatialNodeInfo: Identifiable {
        let id: Int
        var tag: String
        var props: [String: Any]
        var childIds: [Int]
        var parentId: Int?
        var text: String?
    }

    func patchProp(_ payload: [String: Any]) {
        guard let nodeId = payload["nodeId"] as? Int,
              let key = payload["key"] as? String,
              let value = payload["nextValue"] else { return }
        nodes[nodeId]?.props[key] = value
    }

    func insert(_ payload: [String: Any]) {
        guard let nodeId = payload["nodeId"] as? Int,
              let parentId = payload["parentId"] as? Int else { return }
        nodes[nodeId]?.parentId = parentId
        nodes[parentId]?.childIds.append(nodeId)
    }

    func remove(_ payload: [String: Any]) {
        guard let nodeId = payload["nodeId"] as? Int else { return }
        if let parentId = nodes[nodeId]?.parentId {
            nodes[parentId]?.childIds.removeAll { $0 == nodeId }
        }
        nodes.removeValue(forKey: nodeId)
    }
}
```

### 5.2 VueSpatialRuntime.swift

```swift
// VueSpatialRuntime.swift
// JavaScriptCore 环境管理。
// 负责加载 JS bundle、建立桥接通道、处理消息收发。

import JavaScriptCore
import SwiftUI

@MainActor
class VueSpatialRuntime: ObservableObject {
    private var jsContext: JSContext!
    private(set) var viewModel: VueViewModel!

    init() {
        setupJSContext()
        viewModel = VueViewModel(runtime: self)
    }

    // MARK: - JSContext Setup

    private func setupJSContext() {
        jsContext = JSContext()!

        // 注入异常处理
        jsContext.exceptionHandler = { [weak self] context, exception in
            guard let exception = exception else { return }
            print("[VueSpatialRuntime] JS Exception: \(exception)")
        }

        // 注入桥接对象
        let bridge = VueBridgeObject(runtime: self)
        jsContext.setObject(bridge, forKeyedSubscript: "__vueSpatialBridge__" as NSString)

        // 注入 console
        let consoleLog: @convention(block) (String) -> Void = { message in
            print("[Vue JS] \(message)")
        }
        jsContext.setObject(consoleLog, forKeyedSubscript: "console.log" as NSString)

        // 注入 setTimeout / clearTimeout
        setupTimers()
    }

    // MARK: - Bundle Loading

    /// 加载编译后的 JS bundle。
    func loadBundle(named bundleName: String) {
        guard let bundlePath = Bundle.main.path(forResource: bundleName, ofType: "js"),
              let bundleCode = try? String(contentsOfFile: bundlePath, encoding: .utf8) else {
            print("[VueSpatialRuntime] Failed to load bundle: \(bundleName)")
            return
        }

        jsContext.evaluateScript(bundleCode)
    }

    /// 加载 bundle 并启动 Vue 应用。
    func start(bundleName: String = "vue-spatial-app") {
        loadBundle(named: bundleName)

        // 调用入口函数（由构建工具生成）
        jsContext.evaluateScript("__startVueSpatialApp__()")
    }

    // MARK: - JS → Swift Message Handling

    /// 处理来自 JS 侧的消息。
    func handleMessage(_ jsonString: String) {
        guard let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            print("[VueSpatialRuntime] Failed to parse message: \(jsonString)")
            return
        }

        let type = json["type"] as? String ?? ""

        switch type {
        case "batchUpdate":
            if let messages = json["messages"] as? [[String: Any]] {
                viewModel.handleBatchUpdate(messages: messages)
            }
        case "stateUpdate":
            if let payload = json["payload"] as? [String: Any],
               let path = payload["path"] as? String,
               let value = payload["value"] {
                viewModel.handleStateUpdate(path: path, value: value)
            }
        case "openWindow":
            if let payload = json["payload"] as? [String: Any],
               let windowId = payload["windowId"] as? String {
                openWindow(id: windowId)
            }
        case "openImmersive":
            if let payload = json["payload"] as? [String: Any],
               let spaceId = payload["spaceId"] as? String {
                openImmersiveSpace(id: spaceId)
            }
        case "appMounted":
            print("[VueSpatialRuntime] Vue app mounted")
        default:
            print("[VueSpatialRuntime] Unknown message type: \(type)")
        }
    }

    // MARK: - Swift → JS Calls

    /// 调用 JS 侧注册的方法。
    func callJSMethod(_ name: String, args: [Any] = []) {
        let callback: [String: Any] = [
            "type": "action",
            "payload": [
                "method": name,
                "args": args,
            ],
            "timestamp": Date().timeIntervalSince1970 * 1000,
        ]
        sendCallback(callback)
    }

    /// 通知 JS 侧状态变更（用于 v-model 双向绑定）。
    func notifyStateChange(key: String, value: Any) {
        let callback: [String: Any] = [
            "type": "action",
            "payload": [
                "method": "__updateState__",
                "args": [key, value],
            ],
            "timestamp": Date().timeIntervalSince1970 * 1000,
        ]
        sendCallback(callback)
    }

    /// 发送回调到 JS 侧。
    private func sendCallback(_ callback: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: callback),
              let jsonString = String(data: data, encoding: .utf8) else { return }

        jsContext.evaluateScript("__vueSpatialCallback__('\(jsonString.escapedForJS)')")
    }

    // MARK: - Scene Management

    @Environment(\.openWindow) private var openWindowAction
    @Environment(\.openImmersiveSpace) private var openImmersiveSpaceAction
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpaceAction

    func openWindow(id: String) {
        Task {
            openWindowAction(id: id)
        }
    }

    func openImmersiveSpace(id: String) {
        Task {
            await openImmersiveSpaceAction(id: id)
        }
    }

    // MARK: - Timer Support

    private var timers: [Int: Timer] = [:]
    private var nextTimerId = 0

    private func setupTimers() {
        let setTimeout: @convention(block) (JSValue, Double) -> Int = { [weak self] callback, delay in
            guard let self = self else { return -1 }
            let id = self.nextTimerId
            self.nextTimerId += 1

            let timer = Timer.scheduledTimer(withTimeInterval: delay / 1000.0, repeats: false) { _ in
                callback.call(withArguments: [])
                self.timers.removeValue(forKey: id)
            }
            self.timers[id] = timer
            return id
        }

        let clearTimeout: @convention(block) (Int) -> Void = { [weak self] id in
            self?.timers[id]?.invalidate()
            self?.timers.removeValue(forKey: id)
        }

        jsContext.setObject(setTimeout, forKeyedSubscript: "setTimeout" as NSString)
        jsContext.setObject(clearTimeout, forKeyedSubscript: "clearTimeout" as NSString)
    }

    deinit {
        timers.values.forEach { $0.invalidate() }
        timers.removeAll()
    }
}

// MARK: - Bridge Object

/// 注入到 JSContext 中的桥接对象。
/// 实现 JS 侧 __vueSpatialBridge__.postMessage() 方法。
@objc protocol VueBridgeObjectExport: JSExport {
    func postMessage(_ json: String)
}

class VueBridgeObject: NSObject, VueBridgeObjectExport {
    private weak var runtime: VueSpatialRuntime?

    init(runtime: VueSpatialRuntime) {
        self.runtime = runtime
        super.init()
    }

    func postMessage(_ json: String) {
        Task { @MainActor in
            runtime?.handleMessage(json)
        }
    }
}

// MARK: - String Extension

extension String {
    /// 转义 JS 字符串中的特殊字符。
    var escapedForJS: String {
        self.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
    }
}
```

### 5.3 App.swift 模板

```swift
// App.swift
// 由 compiler-spatial 根据 .vue 文件中的场景声明生成。

import SwiftUI

@main
struct VueSpatialApp: App {
    @StateObject private var runtime = VueSpatialRuntime()

    var body: some Scene {
        // 由 <spatial-window> 生成
        WindowGroup("我的应用", id: "main") {
            MainView(viewModel: runtime.viewModel)
                .onAppear {
                    runtime.start(bundleName: "vue-spatial-app")
                }
        }

        // 由 <spatial-volume> 生成
        WindowGroup("3D 视图", id: "volume") {
            VolumeView(viewModel: runtime.viewModel)
        }
        .windowStyle(.volumetric)
        .defaultSize(width: 0.5, height: 0.5, depth: 0.5, in: .meters)

        // 由 <spatial-immersive> 生成
        ImmersiveSpace(id: "immersive") {
            ImmersiveView(viewModel: runtime.viewModel)
        }
        .immersionStyle(selection: .constant(.mixed), in: .mixed, .full)
    }
}
```

### 5.4 BridgeProtocol.swift

```swift
// BridgeProtocol.swift
// 桥接协议消息类型定义。
// 与 runtime-spatial/src/types.ts 中的定义保持一致。

import Foundation

// MARK: - JS → Swift 消息类型

enum BridgeMessageType: String, Codable {
    case createElement
    case createText
    case insert
    case remove
    case setText
    case setElementText
    case patchProp
    case appMounted
    case appUnmounted
    case componentUpdated
    case callMethod
    case emitEvent
    case stateUpdate
    case batchUpdate
    case openWindow
    case closeWindow
    case openImmersive
    case closeImmersive
}

// MARK: - Swift → JS 回调类型

enum BridgeCallbackType: String, Codable {
    case gesture
    case action
    case sceneActive
    case sceneInactive
    case sceneBackground
    case handTracking
    case sceneUnderstanding
    case spatialAudioEvent
    case immersiveStateChanged
    case memoryWarning
}

// MARK: - 消息结构

struct BridgeMessage: Codable {
    let id: Int
    let type: BridgeMessageType
    let payload: [String: AnyCodable]
    let timestamp: Double
}

struct BatchMessage: Codable {
    let type: String // "batchUpdate"
    let messages: [BridgeMessage]
    let frameId: Int
}

struct BridgeCallback: Codable {
    let type: BridgeCallbackType
    let payload: [String: AnyCodable]
    let timestamp: Double
}
```

---

## 6. 构建与测试策略

### 6.1 构建配置

#### 6.1.1 rollup.config.js 修改

现有的 `rollup.config.js`（根目录）通过 `process.env.TARGET` 环境变量确定要构建的包。新包无需修改 rollup 配置本身，只需确保以下条件满足：

1. **包目录结构**：在 `packages/` 下创建 `compiler-spatial` 和 `runtime-spatial` 目录
2. **package.json 中的 buildOptions**：指定 `name`（全局变量名）和 `formats`（输出格式）
3. **aliases.js 自动注册**：`scripts/aliases.js` 会自动扫描 `packages/` 下的目录并注册别名

别名注册已由现有逻辑自动处理（`scripts/aliases.js` 第 25-35 行）：

```javascript
for (const dir of dirs) {
  const key = `@vue/${dir}`
  if (
    dir !== 'vue' &&
    !nonSrcPackages.includes(dir) &&
    !(key in entries) &&
    statSync(new URL(`../packages/${dir}`, import.meta.url)).isDirectory()
  ) {
    entries[key] = resolveEntryForPkg(dir)
  }
}
```

因此 `@vue/compiler-spatial` 和 `@vue/runtime-spatial` 会自动获得别名。

#### 6.1.2 构建命令

```bash
# 构建 compiler-spatial
pnpm build compiler-spatial

# 构建 runtime-spatial
pnpm build runtime-spatial

# 构建所有包（包含新包）
pnpm build

# 仅构建 esm-bundler 格式（开发用）
FORMATS=esm-bundler pnpm build compiler-spatial
FORMATS=esm-bundler pnpm build runtime-spatial
```

#### 6.1.3 TypeScript 配置

需要在根 `tsconfig.json` 的 `paths` 中添加新包的路径映射：

```json
{
  "compilerOptions": {
    "paths": {
      "@vue/compiler-spatial": ["packages/compiler-spatial/src"],
      "@vue/runtime-spatial": ["packages/runtime-spatial/src"]
    }
  }
}
```

### 6.2 测试策略

#### 6.2.1 单元测试：compiler-spatial 代码生成

```typescript
// packages/compiler-spatial/__tests__/codegen.spec.ts

import { compile } from '../src'

describe('compiler-spatial codegen', () => {
  test('基础文本视图', () => {
    const { code } = compile('<text>Hello</text>')
    expect(code).toContain('Text("Hello")')
  })

  test('VStack 布局', () => {
    const { code } = compile(`
      <v-stack spacing="20">
        <text>标题</text>
        <text>内容</text>
      </v-stack>
    `)
    expect(code).toContain('VStack(spacing: 20)')
    expect(code).toContain('Text("标题")')
    expect(code).toContain('Text("内容")')
  })

  test('v-if 条件编译', () => {
    const { code } = compile(`
      <text v-if="isVisible">可见</text>
      <text v-else>不可见</text>
    `)
    expect(code).toContain('if viewModel.isVisible {')
    expect(code).toContain('} else {')
  })

  test('v-for 列表编译', () => {
    const { code } = compile(`
      <text v-for="item in items" :key="item.id">
        {{ item.name }}
      </text>
    `)
    expect(code).toContain('ForEach(viewModel.items')
    expect(code).toContain('{ item in')
  })

  test('v-model 双向绑定', () => {
    const { code } = compile(`
      <text-field v-model="username" />
    `)
    expect(code).toContain('$viewModel.username')
  })

  test('按钮事件', () => {
    const { code } = compile(`
      <button @tap="handleTap">点击</button>
    `)
    expect(code).toContain('Button(action:')
    expect(code).toContain('viewModel.handleTap()')
  })

  test('spatial-window 场景', () => {
    const { code } = compile(`
      <spatial-window title="测试" id="main">
        <text>内容</text>
      </spatial-window>
    `)
    expect(code).toContain('WindowGroup("测试", id: "main")')
  })

  test('插值表达式', () => {
    const { code } = compile(`
      <text>计数: {{ count }}</text>
    `)
    expect(code).toContain('Text("计数: \\(viewModel.count)")')
  })
})
```

#### 6.2.2 单元测试：桥接协议

```typescript
// packages/runtime-spatial/__tests__/bridge.spec.ts

import { SpatialBridgeImpl } from '../src/bridge'
import { BridgeMessageType, BridgeCallbackType } from '../src/types'

describe('SpatialBridge', () => {
  let bridge: SpatialBridgeImpl
  let postedMessages: string[]

  beforeEach(() => {
    postedMessages = []
    // 模拟 Swift 注入的桥接对象
    ;(globalThis as any).__vueSpatialBridge__ = {
      postMessage: (json: string) => {
        postedMessages.push(json)
      },
    }
    bridge = new SpatialBridgeImpl()
  })

  afterEach(() => {
    bridge.destroy()
    delete (globalThis as any).__vueSpatialBridge__
  })

  test('发送消息', () => {
    bridge.send(BridgeMessageType.CREATE_ELEMENT, {
      nodeId: 1,
      tag: 'v-stack',
    })

    expect(postedMessages.length).toBe(1)
    const msg = JSON.parse(postedMessages[0])
    expect(msg.type).toBe('createElement')
    expect(msg.payload.nodeId).toBe(1)
    expect(msg.payload.tag).toBe('v-stack')
  })

  test('接收回调', () => {
    const handler = vi.fn()
    bridge.on(BridgeCallbackType.GESTURE, handler)

    // 模拟 Swift 调用回调
    const callback = JSON.stringify({
      type: 'gesture',
      payload: { gestureType: 'spatialTap' },
      timestamp: Date.now(),
    })
    ;(globalThis as any).__vueSpatialCallback__(callback)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0][0].payload.gestureType).toBe('spatialTap')
  })

  test('取消回调注册', () => {
    const handler = vi.fn()
    bridge.on(BridgeCallbackType.GESTURE, handler)
    bridge.off(BridgeCallbackType.GESTURE, handler)

    const callback = JSON.stringify({
      type: 'gesture',
      payload: {},
      timestamp: Date.now(),
    })
    ;(globalThis as any).__vueSpatialCallback__(callback)

    expect(handler).not.toHaveBeenCalled()
  })
})
```

#### 6.2.3 单元测试：调度器

```typescript
// packages/runtime-spatial/__tests__/scheduler.spec.ts

import { SpatialScheduler } from '../src/scheduler'
import { BridgeMessageType } from '../src/types'
import type { SpatialBridge, BridgeMessage, BatchMessage } from '../src/types'

describe('SpatialScheduler', () => {
  let scheduler: SpatialScheduler
  let postedMessages: (BridgeMessage | BatchMessage)[]
  let mockBridge: SpatialBridge

  beforeEach(() => {
    vi.useFakeTimers()
    postedMessages = []
    mockBridge = {
      postMessage: (msg) => postedMessages.push(msg),
      onCallback: () => {},
      destroy: () => {},
    }
    scheduler = new SpatialScheduler(mockBridge, 16)
  })

  afterEach(() => {
    scheduler.destroy()
    vi.useRealTimers()
  })

  test('批量合并消息', () => {
    const msg1: BridgeMessage = {
      id: 1,
      type: BridgeMessageType.PATCH_PROP,
      payload: { nodeId: 1, key: 'spacing', prevValue: 10, nextValue: 20 },
      timestamp: Date.now(),
    }
    const msg2: BridgeMessage = {
      id: 2,
      type: BridgeMessageType.SET_TEXT,
      payload: { nodeId: 2, text: 'hello' },
      timestamp: Date.now(),
    }

    scheduler.enqueue(msg1)
    scheduler.enqueue(msg2)

    expect(postedMessages.length).toBe(0)

    vi.advanceTimersByTime(16)

    expect(postedMessages.length).toBe(1)
    const batch = postedMessages[0] as BatchMessage
    expect(batch.type).toBe(BridgeMessageType.BATCH_UPDATE)
    expect(batch.messages.length).toBe(2)
  })

  test('单条消息直接发送', () => {
    const msg: BridgeMessage = {
      id: 1,
      type: BridgeMessageType.PATCH_PROP,
      payload: { nodeId: 1, key: 'spacing', prevValue: 10, nextValue: 20 },
      timestamp: Date.now(),
    }

    scheduler.enqueue(msg)
    vi.advanceTimersByTime(16)

    expect(postedMessages.length).toBe(1)
    expect((postedMessages[0] as BridgeMessage).type).toBe(BridgeMessageType.PATCH_PROP)
  })

  test('flush 立即发送', () => {
    scheduler.enqueue({
      id: 1,
      type: BridgeMessageType.PATCH_PROP,
      payload: {},
      timestamp: Date.now(),
    })

    scheduler.flush()

    expect(postedMessages.length).toBe(1)
  })
})
```

#### 6.2.4 集成测试：端到端编译

```typescript
// packages/compiler-spatial/__tests__/integration.spec.ts

import { parse } from '@vue/compiler-sfc'
import { compile } from '../src'

describe('端到端集成测试', () => {
  test('编译完整的空间组件', () => {
    const source = `
<script setup spatial lang="ts">
import { ref } from 'vue'

const count = ref(0)

function increment() {
  count.value++
}
</script>

<template spatial>
  <spatial-window title="计数器">
    <v-stack spacing="20">
      <text font="largeTitle">{{ count }}</text>
      <button @tap="increment">+1</button>
    </v-stack>
  </spatial-window>
</template>

<style spatial>
text {
  foreground-color: primary;
  padding: 16;
}
</style>
`

    // 1. 解析 SFC
    const { descriptor, errors } = parse(source)
    expect(errors.length).toBe(0)
    expect(descriptor.spatial).toBe(true)
    expect(descriptor.templateSpatial).not.toBeNull()
    expect(descriptor.scriptSetupSpatial).not.toBeNull()

    // 2. 编译模板为 SwiftUI
    const templateContent = descriptor.templateSpatial!.content
    const result = compile(templateContent, {
      filename: 'Counter.vue',
    })

    expect(result.errors.length).toBe(0)

    // 3. 验证生成的 SwiftUI 代码
    const swiftCode = result.code
    expect(swiftCode).toContain('struct CounterView: View')
    expect(swiftCode).toContain('@ObservedObject var viewModel: VueViewModel')
    expect(swiftCode).toContain('WindowGroup("计数器")')
    expect(swiftCode).toContain('VStack(spacing: 20)')
    expect(swiftCode).toContain('Text("\\(viewModel.count)")')
    expect(swiftCode).toContain('Button(action:')
    expect(swiftCode).toContain('.font(.largeTitle)')
  })
})
```

### 6.3 快照测试

对于代码生成器，建议使用快照测试确保输出稳定：

```typescript
// packages/compiler-spatial/__tests__/snapshot/counter.spec.ts

import { compile } from '../../src'

test('Counter 组件快照', () => {
  const { code } = compile(`
    <spatial-window title="计数器">
      <v-stack spacing="20">
        <text font="largeTitle">{{ count }}</text>
        <button @tap="increment">+1</button>
        <button @tap="decrement">-1</button>
      </v-stack>
    </spatial-window>
  `, {
    filename: 'Counter.vue',
  })

  expect(code).toMatchSnapshot()
})
```

---

## 7. 开发阶段与任务分解

### 阶段 1：compiler-sfc 解析变更（1 周）

| 任务 | 文件 | 详情 | 预估 |
|------|------|------|------|
| 1.1 | `packages/compiler-sfc/src/parse.ts` | 扩展 `SFCDescriptor`、`SFCScriptBlock`、`SFCTemplateBlock` 接口，添加 spatial 字段 | 0.5 天 |
| 1.2 | `packages/compiler-sfc/src/parse.ts` | 修改 `parse()` 函数中 `template`、`script`、`style` 的 switch 分支，处理 spatial 属性 | 1 天 |
| 1.3 | `packages/compiler-sfc/src/parse.ts` | 添加 `SFCSpatialStyleBlock` 类型 | 0.5 天 |
| 1.4 | `packages/compiler-sfc/src/compileScript.ts` | 添加 `SpatialCompiler` 接口、`spatialOptions` 配置 | 0.5 天 |
| 1.5 | `packages/compiler-sfc/src/compileScript.ts` | 实现 `compileSpatialScript()` 函数，路由到 spatial 管线 | 1 天 |
| 1.6 | `packages/compiler-sfc/src/index.ts` | 添加 spatial 相关类型和函数导出 | 0.5 天 |
| 1.7 | `packages/compiler-sfc/__tests__/parse.spec.ts` | 编写 spatial 解析单元测试 | 1 天 |

**里程碑**：`parse('<script setup spatial>...')` 能正确返回包含 `spatial: true` 和 `scriptSetupSpatial` 的 `SFCDescriptor`。

### 阶段 2：compiler-spatial 基础代码生成（2 周）

| 任务 | 文件 | 详情 | 预估 |
|------|------|------|------|
| 2.1 | `packages/compiler-spatial/` | 初始化包结构、package.json、tsconfig | 0.5 天 |
| 2.2 | `src/index.ts`、`src/options.ts` | 公共 API 和配置类型 | 0.5 天 |
| 2.3 | `src/transforms/transformElement.ts` | 元素映射表（布局视图、内容视图、导航视图） | 1 天 |
| 2.4 | `src/transforms/transformText.ts`、`src/transforms/transformInterpolation.ts` | Text 视图和插值表达式编译 | 1 天 |
| 2.5 | `src/codegen.ts` | 核心代码生成器：AST 遍历、SwiftUI 代码输出 | 2 天 |
| 2.6 | `src/components/spatialWindow.ts` | `<spatial-window>` → WindowGroup | 0.5 天 |
| 2.7 | `src/components/spatialVolume.ts` | `<spatial-volume>` → 体积窗口 | 0.5 天 |
| 2.8 | `src/components/spatialImmersive.ts` | `<spatial-immersive>` → ImmersiveSpace | 0.5 天 |
| 2.9 | `src/utils/swiftTypes.ts`、`src/utils/swiftFormat.ts` | Swift 类型映射和格式化工具 | 1 天 |
| 2.10 | `__tests__/codegen.spec.ts`、`__tests__/transformElement.spec.ts` | 代码生成单元测试 | 2 天 |

**里程碑**：`compile('<v-stack><text>Hello</text></v-stack>')` 生成正确的 `VStack { Text("Hello") }` SwiftUI 代码。

### 阶段 3：指令编译（2 周）

| 任务 | 文件 | 详情 | 预估 |
|------|------|------|------|
| 3.1 | `src/transforms/transformDirective.ts` | v-if / v-else-if / v-else → Swift if/else | 1.5 天 |
| 3.2 | `src/transforms/transformDirective.ts` | v-for → ForEach（含 key 处理） | 2 天 |
| 3.3 | `src/transforms/transformDirective.ts` | v-model → @Binding 参数（适配各元素类型） | 2 天 |
| 3.4 | `src/transforms/transformDirective.ts` | v-show → .opacity modifier | 0.5 天 |
| 3.5 | `src/transforms/transformEvent.ts` | 事件编译：@tap、@drag、@long-press 等 | 2 天 |
| 3.6 | `__tests__/transformDirective.spec.ts`、`__tests__/transformEvent.spec.ts` | 指令编译单元测试 | 2 天 |

**里程碑**：`<text v-if="show">{{ msg }}</text>` 编译为 `if viewModel.show { Text("\(viewModel.msg)") }`。

### 阶段 4：runtime-spatial 桥接与 Composables（3 周）

| 任务 | 文件 | 详情 | 预估 |
|------|------|------|------|
| 4.1 | `packages/runtime-spatial/` | 初始化包结构 | 0.5 天 |
| 4.2 | `src/types.ts` | 全部 TypeScript 类型定义 | 1 天 |
| 4.3 | `src/bridge.ts` | SpatialBridge IPC 实现（JS → Swift、Swift → JS） | 2 天 |
| 4.4 | `src/nodeOps.ts` | 空间节点操作（参照 runtime-test） | 1 天 |
| 4.5 | `src/patchProp.ts` | 属性 patch 逻辑 | 1 天 |
| 4.6 | `src/renderer.ts` | 基于 createRenderer 的自定义渲染器 | 1 天 |
| 4.7 | `src/scheduler.ts` | 帧批量调度器 | 1 天 |
| 4.8 | `src/index.ts` | createSpatialApp 入口 | 1 天 |
| 4.9 | `src/composables/useSpatialGesture.ts` | 空间手势 composable | 1 天 |
| 4.10 | `src/composables/useSpatialScene.ts` | 场景管理 composable | 1 天 |
| 4.11 | `src/composables/useHandTracking.ts` | 手部追踪 composable | 1 天 |
| 4.12 | `src/composables/useSpatialAudio.ts` | 空间音频 composable | 1 天 |
| 4.13 | `src/composables/useSceneUnderstanding.ts` | 场景理解 composable | 1 天 |
| 4.14 | `src/lifecycle.ts` | 空间生命周期钩子 | 0.5 天 |
| 4.15 | `__tests__/` | 桥接、渲染器、调度器单元测试 | 2 天 |

**里程碑**：`createSpatialApp(App).mount()` 能通过模拟桥接正确创建虚拟节点树并发送 IPC 消息。

### 阶段 5：样式编译（1 周）

| 任务 | 文件 | 详情 | 预估 |
|------|------|------|------|
| 5.1 | `src/transforms/transformStyle.ts` | 类 CSS 语法解析器 | 1 天 |
| 5.2 | `src/transforms/transformStyle.ts` | CSS 属性 → SwiftUI modifier 映射表 | 1 天 |
| 5.3 | `src/transforms/transformStyle.ts` | 颜色、字体、按钮样式常量映射 | 0.5 天 |
| 5.4 | `src/transforms/transformSlot.ts` | Slot → @ViewBuilder 参数编译 | 1 天 |
| 5.5 | 测试 | 样式编译单元测试 | 1.5 天 |

**里程碑**：`<style spatial>text { font: largeTitle; padding: 16; }</style>` 编译为 `.font(.largeTitle).padding(16)` modifier 链。

### 阶段 6：集成测试与 Swift 模板（2 周）

| 任务 | 文件 | 详情 | 预估 |
|------|------|------|------|
| 6.1 | Swift 模板 | VueViewModel.swift | 1 天 |
| 6.2 | Swift 模板 | VueSpatialRuntime.swift（JSContext 管理） | 2 天 |
| 6.3 | Swift 模板 | App.swift 模板生成器 | 1 天 |
| 6.4 | Swift 模板 | BridgeProtocol.swift | 0.5 天 |
| 6.5 | 集成测试 | 端到端：.vue spatial 文件 → SwiftUI 代码 → 桥接验证 | 2 天 |
| 6.6 | 文档 | API 文档、用户指南 | 1 天 |
| 6.7 | CI 配置 | 新包的构建和测试 CI 流程 | 0.5 天 |
| 6.8 | 示例项目 | 创建示例 visionOS 项目验证完整流程 | 2 天 |

**最终里程碑**：从 `.vue` 空间组件文件出发，通过编译生成 SwiftUI 代码和 JS bundle，在 visionOS 模拟器中运行并展示带响应式数据绑定的空间窗口。

### 总时间线

```
第 1 周  ▓▓▓▓▓▓▓▓▓▓  阶段 1: compiler-sfc 解析
第 2-3 周 ▓▓▓▓▓▓▓▓▓▓  阶段 2: compiler-spatial 基础
第 4-5 周 ▓▓▓▓▓▓▓▓▓▓  阶段 3: 指令编译
第 6-8 周 ▓▓▓▓▓▓▓▓▓▓  阶段 4: runtime-spatial
第 9 周   ▓▓▓▓▓▓▓▓▓▓  阶段 5: 样式编译
第 10-11 周▓▓▓▓▓▓▓▓▓▓  阶段 6: 集成与模板
──────────────────────
总计约 11 周
```

---

## 附录 A：关键文件路径速查

| 目的 | 文件路径 |
|------|---------|
| SFC 解析入口 | `packages/compiler-sfc/src/parse.ts` |
| SFC 脚本编译 | `packages/compiler-sfc/src/compileScript.ts` |
| SFC 公共导出 | `packages/compiler-sfc/src/index.ts` |
| 脚本编译上下文 | `packages/compiler-sfc/src/script/context.ts` |
| 核心 AST 定义 | `packages/compiler-core/src/ast.ts` |
| Transform 架构 | `packages/compiler-core/src/transform.ts` |
| 核心代码生成器 | `packages/compiler-core/src/codegen.ts` |
| 自定义渲染器接口 | `packages/runtime-core/src/renderer.ts`（RendererOptions, 第 108-145 行） |
| createApp API | `packages/runtime-core/src/apiCreateApp.ts` |
| runtime-test 参考实现 | `packages/runtime-test/src/index.ts` |
| runtime-test nodeOps | `packages/runtime-test/src/nodeOps.ts` |
| 构建配置 | `rollup.config.js` |
| 包别名注册 | `scripts/aliases.js` |

## 附录 B：完整 .vue Spatial 组件示例

```vue
<!-- TodoSpatial.vue -->
<!-- 一个空间计算的待办事项应用示例 -->

<script setup spatial lang="ts">
import { ref, computed } from 'vue'
import {
  useSpatialGesture,
  useSpatialScene,
  onSpatialEnter,
  onSpatialLeave,
} from '@vue/runtime-spatial'

interface Todo {
  id: number
  text: string
  done: boolean
}

const todos = ref<Todo[]>([
  { id: 1, text: '学习 Vue Spatial', done: false },
  { id: 2, text: '构建 visionOS 应用', done: false },
])

const newTodoText = ref('')
const filter = ref<'all' | 'active' | 'done'>('all')

const filteredTodos = computed(() => {
  switch (filter.value) {
    case 'active': return todos.value.filter(t => !t.done)
    case 'done': return todos.value.filter(t => t.done)
    default: return todos.value
  }
})

const remainingCount = computed(() =>
  todos.value.filter(t => !t.done).length
)

function addTodo() {
  if (newTodoText.value.trim()) {
    todos.value.push({
      id: Date.now(),
      text: newTodoText.value.trim(),
      done: false,
    })
    newTodoText.value = ''
  }
}

function toggleTodo(id: number) {
  const todo = todos.value.find(t => t.id === id)
  if (todo) todo.done = !todo.done
}

function removeTodo(id: number) {
  todos.value = todos.value.filter(t => t.id !== id)
}

const { openImmersive } = useSpatialScene()

onSpatialEnter(() => {
  console.log('待办事项窗口已打开')
})
</script>

<template spatial>
  <spatial-window title="待办事项" id="todo-main"
    :default-size="{ width: 600, height: 800 }">
    <navigation-stack>
      <v-stack spacing="16">
        <!-- 输入区域 -->
        <h-stack spacing="12">
          <text-field v-model="newTodoText" placeholder="添加新待办..." />
          <button @tap="addTodo">添加</button>
        </h-stack>

        <!-- 筛选器 -->
        <picker v-model="filter">
          <text tag="all">全部</text>
          <text tag="active">进行中</text>
          <text tag="done">已完成</text>
        </picker>

        <!-- 待办列表 -->
        <scroll-view>
          <lazy-v-stack spacing="8">
            <h-stack v-for="todo in filteredTodos" :key="todo.id"
              spacing="12">
              <toggle v-model="todo.done" />
              <text v-if="!todo.done">{{ todo.text }}</text>
              <text v-else>{{ todo.text }}</text>
              <spacer />
              <button @tap="removeTodo(todo.id)" role="destructive">
                <image system-name="trash" />
              </button>
            </h-stack>
          </lazy-v-stack>
        </scroll-view>

        <!-- 底部状态 -->
        <text>剩余 {{ remainingCount }} 项未完成</text>
      </v-stack>
    </navigation-stack>
  </spatial-window>
</template>

<style spatial scoped>
text-field {
  padding: 8;
  background: quaternarySystemFill;
  corner-radius: 8;
}

button {
  button-style: borderedProminent;
}

text[done] {
  foreground-color: secondary;
}

h-stack {
  padding-horizontal: 16;
  padding-vertical: 8;
  background: secondarySystemBackground;
  corner-radius: 12;
}
</style>
```

此示例展示了空间计算组件的完整用法，包括：
- `<script setup spatial>` 中的标准 Vue 3 响应式逻辑
- `<template spatial>` 中的空间窗口声明、布局组件、指令使用
- `<style spatial>` 中的类 CSS 样式声明
- Composable 和生命周期钩子的使用
