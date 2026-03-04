# 1. runtime-core 运行时核心导出的所有变量， 函数， ts 类型都有哪些？按分类列举一下

 

## 1. Core API

### 版本信息
- `version: string` - 运行时版本

### 响应式 API（从 @vue/reactivity 导入）
- **核心**：`reactive`, `ref`, `readonly`
- **工具**：`unref`, `proxyRefs`, `isRef`, `toRef`, `toValue`, `toRefs`, `isProxy`, `isReactive`, `isReadonly`, `isShallow`
- **高级**：`customRef`, `triggerRef`, `shallowRef`, `shallowReactive`, `shallowReadonly`, `markRaw`, `toRaw`
- **Effect**：`effect`, `stop`, `getCurrentWatcher`, `onWatcherCleanup`, `ReactiveEffect`
- **Effect Scope**：`effectScope`, `EffectScope`, `getCurrentScope`, `onScopeDispose`

### 计算属性
- `computed`

### 监听器
- `watch`, `watchEffect`, `watchPostEffect`, `watchSyncEffect`

### 生命周期钩子
- `onBeforeMount`, `onMounted`, `onBeforeUpdate`, `onUpdated`, `onBeforeUnmount`, `onUnmounted`, `onActivated`, `onDeactivated`, `onRenderTracked`, `onRenderTriggered`, `onErrorCaptured`, `onServerPrefetch`

### 依赖注入
- `provide`, `inject`, `hasInjectionContext`

### 其他
- `nextTick`
- `defineComponent`
- `defineAsyncComponent`
- `useAttrs`, `useSlots`
- `useModel`
- `useTemplateRef`, `TemplateRef`
- `useId`
- `hydrateOnIdle`, `hydrateOnVisible`, `hydrateOnMediaQuery`, `hydrateOnInteraction`

## 2. <script setup> API

### 宏运行时（用于类型和警告）
- `defineProps`, `defineEmits`, `defineExpose`, `defineOptions`, `defineSlots`, `defineModel`, `withDefaults`
- **类型**：`DefineProps`, `ModelRef`, `ComponentTypeEmits`

### 内部 API
- `mergeDefaults`, `mergeModels`, `createPropsRestProxy`, `withAsyncContext`

## 3. Advanced API

### 内部实例
- `getCurrentInstance`
- `useInstanceOption`（内部）

### 渲染函数
- `h`
- `createVNode`, `cloneVNode`, `mergeProps`, `isVNode`

### VNode 类型
- `Fragment`, `Text`, `Comment`, `Static`, `VNodeRef`

### 内置组件
- `Teleport`, `TeleportProps`
- `Suspense`, `SuspenseProps`
- `KeepAlive`, `KeepAliveProps`, `KeepAliveContext`
- `BaseTransition`, `BaseTransitionPropsValidators`, `BaseTransitionProps`

### 自定义指令
- `withDirectives`

### SSR 上下文
- `useSSRContext`, `ssrContextKey`

### 其他
- `MoveType`

## 4. Custom Renderer API

### 渲染器创建
- `createRenderer`, `createHydrationRenderer`

### 调度器
- `queuePostFlushCb`

### 警告
- `warn`
- `assertNumber`（内部）

### 错误处理
- `handleError`, `callWithErrorHandling`, `callWithAsyncErrorHandling`, `ErrorCodes`

### 资源解析
- `resolveComponent`, `resolveDirective`, `resolveDynamicComponent`, `NULL_DYNAMIC_COMPONENT`

### 运行时编译器集成
- `registerRuntimeCompiler`, `isRuntimeOnly`

### 过渡相关
- `useTransitionState`, `resolveTransitionHooks`, `setTransitionHooks`, `getTransitionRawChildren`

### 自定义格式化器
- `initCustomFormatter`

### 错误类型字符串
- `ErrorTypeStrings`（内部）

### 开发者工具
- `devtools`, `setDevtoolsHook`

## 5. Types

### 从 @vue/reactivity 导入的类型
- `Ref`, `MaybeRef`, `MaybeRefOrGetter`, `ToRef`, `ToRefs`, `UnwrapRef`, `ShallowRef`, `ShallowUnwrapRef`, `CustomRefFactory`, `ReactiveFlags`, `DeepReadonly`, `ShallowReactive`, `UnwrapNestedRefs`, `ComputedRef`, `WritableComputedRef`, `WritableComputedOptions`, `ComputedGetter`, `ComputedSetter`, `ReactiveEffectRunner`, `ReactiveEffectOptions`, `EffectScheduler`, `DebuggerOptions`, `DebuggerEvent`, `DebuggerEventExtraInfo`, `Raw`, `Reactive`

### 监听器类型
- `MultiWatchSources`, `WatchEffect`, `WatchOptions`, `WatchOptionsBase`, `WatchCallback`, `WatchSource`, `WatchHandle`, `WatchStopHandle`

### 依赖注入类型
- `InjectionKey`

### 应用类型
- `App`, `AppConfig`, `AppContext`, `GenericAppContext`, `Plugin`, `ObjectPlugin`, `FunctionPlugin`, `CreateAppFunction`, `OptionMergeFunction`

### VNode 类型
- `VNode`, `VNodeChild`, `VNodeTypes`, `VNodeProps`, `VNodeArrayChildren`, `VNodeNormalizedChildren`

### 组件类型
- `Component`, `ConcreteComponent`, `FunctionalComponent`, `ComponentInternalInstance`, `SetupContext`, `ComponentCustomProps`, `AllowedComponentProps`, `GlobalComponents`, `GlobalDirectives`, `ComponentInstance`, `ComponentCustomElementInterface`, `AsyncComponentInternalOptions`

### 组件定义类型
- `DefineComponent`, `DefineSetupFnComponent`, `PublicProps`

### 组件选项类型
- `ComponentOptions`, `ComponentOptionsMixin`, `ComponentCustomOptions`, `ComponentOptionsBase`, `ComponentProvideOptions`, `RenderFunction`, `MethodOptions`, `ComputedOptions`, `RuntimeCompilerOptions`, `ComponentInjectOptions`, `ComponentOptionsWithoutProps`（已废弃）, `ComponentOptionsWithArrayProps`（已废弃）, `ComponentOptionsWithObjectProps`（已废弃）

### 组件事件类型
- `EmitsOptions`, `ObjectEmitsOptions`, `EmitsToProps`, `ShortEmitsToObject`, `EmitFn`, `TypeEmitsToOptions`

### 组件实例类型
- `ComponentPublicInstance`, `ComponentCustomProperties`, `CreateComponentPublicInstance`, `CreateComponentPublicInstanceWithMixins`

### 渲染器类型
- `Renderer`, `RendererNode`, `RendererElement`, `HydrationRenderer`, `RendererOptions`, `RootRenderFunction`, `ElementNamespace`

###  hydration 类型
- `RootHydrateFunction`

### 插槽类型
- `Slot`, `Slots`, `SlotsType`

### 属性类型
- `Prop`, `PropType`, `ComponentPropsOptions`, `ComponentObjectPropsOptions`, `ExtractPropTypes`, `ExtractPublicPropTypes`, `ExtractDefaultPropTypes`

### 指令类型
- `Directive`, `DirectiveBinding`, `DirectiveHook`, `ObjectDirective`, `FunctionDirective`, `DirectiveArguments`, `DirectiveModifiers`

### 其他类型
- `SuspenseBoundary`
- `TransitionState`, `TransitionHooks`, `TransitionHooksContext`, `TransitionElement`
- `AsyncComponentOptions`, `AsyncComponentLoader`
- `HydrationStrategy`, `HydrationStrategyFactory`
- `HMRRuntime`
- `SchedulerJob`

## 6. Internal API

### 编译器生成代码使用的 API
- `withCtx`, `pushScopeId`, `popScopeId`, `withScopeId`
- `renderList`, `toHandlers`, `renderSlot`, `createSlots`
- `withMemo`, `isMemoSame`
- `openBlock`, `createBlock`, `setBlockTracking`, `createTextVNode`, `createCommentVNode`, `createStaticVNode`, `createElementVNode`, `createElementBlock`, `guardReactiveProps`

### 共享工具函数
- `toDisplayString`, `camelize`, `capitalize`, `toHandlerKey`, `normalizeProps`, `normalizeClass`, `normalizeStyle`

### 其他内部 API
- `setIsHydratingEnabled`
- `transformVNodeArgs`（用于测试工具）

## 7. SSR

### SSR 工具
- `ssrUtils`（仅在 SSR 可能的构建中暴露）
  - `createComponentInstance`, `setupComponent`, `renderComponentRoot`, `setCurrentRenderingInstance`, `isVNode`, `normalizeVNode`, `getComponentPublicInstance`, `ensureValidVNode`, `pushWarningContext`, `popWarningContext`

## 8. 2.x COMPAT

### 类型
- `CompatVue`, `LegacyConfig`

### 兼容性工具
- `resolveFilter`（仅在兼容构建中暴露）
- `compatUtils`（仅在兼容构建中暴露）
  - `warnDeprecation`, `createCompatVue`, `isCompatEnabled`, `checkCompatEnabled`, `softAssertCompatEnabled`
- `DeprecationTypes`（仅在兼容构建中暴露）

## 9. VAPOR

### 类型（runtime-vapor 依赖）
- `ComponentInternalOptions`, `GenericComponentInstance`, `LifecycleHook`, `NormalizedPropsOptions`, `VaporInteropInterface`, `RendererInternals`, `TeleportTargetElement`, `VNodeNormalizedRef`, `GenericComponent`

### 内部 API
- `getInheritedScopeIds`
- `baseNormalizePropsOptions`, `resolvePropValue`, `validateProps`
- `baseEmit`, `isEmitListener`
- `queueJob`, `flushOnAppMount`, `SchedulerJobFlags`
- `expose`, `nextUid`, `validateComponentName`
- `pushWarningContext`, `popWarningContext`
- `createAppAPI`, `AppMountFn`, `AppUnmountFn`
- `currentInstance`, `setCurrentInstance`, `simpleSetCurrentInstance`
- `registerHMR`, `unregisterHMR`
- `startMeasure`, `endMeasure`
- `initFeatureFlags`
- `resolveTeleportTarget`, `isTeleportDisabled`, `isTeleportDeferred`
- `createAsyncComponentContext`, `useAsyncComponentState`, `isAsyncWrapper`, `performAsyncHydrate`
- `markAsyncBoundary`
- `setRef`
- `normalizeRef`
- `ensureVaporSlotFallback`
- `getComponentName`
- `matches`, `isKeepAlive`, `resetShapeFlag`, `activate`, `deactivate`
- `devtoolsComponentAdded`
- `performTransitionEnter`, `performTransitionLeave`
- `createInternalObject`
- `MismatchTypes`, `isMismatchAllowed`, `toClassSet`, `isSetEqual`, `warnPropMismatch`, `toStyleMap`, `isMapEqual`, `isValidHtmlOrSvgAttribute`, `getAttributeMismatch`, `isHydrating`
- `createCanSetSetupRefChecker`
- `isTemplateNode`
- `baseResolveTransitionHooks`, `checkTransitionMode`, `leaveCbKey`
- `warnExtraneousAttributes`, `getFunctionalFallthrough`
- `knownTemplateRefs`, `isTemplateRefKey`
- `setCurrentRenderingInstance`

## 总结

runtime-core 导出的内容非常丰富，涵盖了 Vue 运行时的核心功能，包括响应式系统、组件系统、渲染系统、生命周期管理等。这些导出内容可以分为以下几个主要类别：

1. **核心 API**：包括响应式 API、计算属性、监听器、生命周期钩子等
2. **脚本设置 API**：用于 `<script setup>` 语法的宏和工具
3. **高级 API**：包括渲染函数、VNode 操作、内置组件等
4. **自定义渲染器 API**：用于创建自定义渲染器的工具和函数
5. **类型定义**：各种 TypeScript 类型，用于类型检查和开发体验
6. **内部 API**：供编译器生成代码和内部使用的 API
7. **SSR 相关**：服务器端渲染相关的工具
8. **2.x 兼容性**：用于兼容 Vue 2.x 的 API
9. **Vapor 相关**：供 runtime-vapor 使用的 API

这些导出内容构成了 Vue 3 运行时的核心功能，为开发者提供了丰富的工具和 API 来构建各种类型的应用。



 
# 2. apiCreateApp.ts介绍该文件的作用，以及它使用的什么设计模式
 
## 文件作用

`apiCreateApp.ts` 是 Vue.js 3 核心运行时中**创建应用实例**的核心文件。它主要实现了以下功能：

### 1. 核心功能

| 功能 | 说明 |
|------|------|
| **创建应用上下文** | `createAppContext()` 创建应用级别的配置、组件、指令等上下文 |
| **创建应用实例** | `createAppAPI()` 返回 `createApp` 函数，用于创建 App 实例 |
| **应用生命周期管理** | 提供 `mount()`、`unmount()`、`onUnmount()` 等方法 |
| **插件系统** | `use()` 方法支持插件安装 |
| **全局组件/指令注册** | `component()`、`directive()`、`mixin()` 方法 |
| **依赖注入** | `provide()`、`runWithContext()` 实现跨组件状态共享 |

### 2. 主要接口定义

- `App` - 应用实例接口，包含版本、配置、各种方法
- `AppConfig` - 应用配置（错误处理、性能监控、编译选项等）
- `AppContext` - 应用上下文（组件、指令、mixins 等）
- `Plugin` - 插件类型定义

---

## 使用的设计模式
        
            
toolName: todo_write
            
status: success
          
Todos updated: 2 items
          
### 1. **工厂模式 (Factory Pattern)**

```typescript
// 第 311-315 行
export function createAppAPI<HostElement, Comp = Component>(
  mount: AppMountFn<HostElement>,
  unmount: AppUnmountFn,
  getPublicInstance: (instance: GenericComponentInstance) => any,
  render?: RootRenderFunction,
): CreateAppFunction<HostElement, Comp> {
  return function createApp(rootComponent, rootProps = null) {
    // 创建 App 实例...
  }
}
```

`createAppAPI` 是一个**工厂函数**，接收渲染器相关的函数，返回 `createApp` 函数。这使得 VDOM 和 Vapor 两种渲染模式可以复用同一套应用创建逻辑。

### 2. **构建者模式 (Builder Pattern)**

App 实例的方法都返回 `this`，支持链式调用：

```typescript
// 第 355-360 行
use(plugin: Plugin, ...options: any[]) {
  // ...
  return app  // 返回 this 支持链式调用
},

mixin(mixin: ComponentOptions) {
  // ...
  return app
},

component(name: string, component?: Component): any {
  // ...
  return app
},
```

使用方式：
```javascript
app.use(plugin).component('Comp', Comp).mount('#app')
```

### 3. **插件模式 (Plugin Pattern)**

```typescript
// 第 172-179 行
export type ObjectPlugin<Options = any[]> = {
  install: PluginInstallFunction<Options>
}
export type FunctionPlugin<Options = any[]> = PluginInstallFunction<Options> &
  Partial<ObjectPlugin<Options>>

export type Plugin<Options = any[]> = FunctionPlugin<P> | ObjectPlugin<P>
```

支持两种插件形式：
- **函数插件**: `(app, options) => void`
- **对象插件**: `{ install(app, options) {} }`

### 4. **依赖注入模式 (Dependency Injection)**

```typescript
// 第 455-460 行
provide(key, value) {
  context.provides[key as string | symbol] = value
  return app
},

// 第 462-469 行
runWithContext(fn) {
  const lastApp = currentApp
  currentApp = app
  try {
    return fn()
  } finally {
    currentApp = lastApp
  }
},
```

通过 `provide` 提供依赖，`runWithContext` 配合 `inject()` 实现跨层级依赖注入。

### 5. **单例模式变体 (Singleton-like)**

每个容器只能挂载一个应用实例：

```typescript
// 第 389-396 行
if (__DEV__ && rootContainer.__vue_app__) {
  warn(
    `There is already an app instance mounted on the host container...`
  )
}
```

### 6. **策略模式 (Strategy Pattern)**

`optionMergeStrategies` 允许自定义选项合并策略：

```typescript
// 第 148 行
optionMergeStrategies: Record<string, OptionMergeFunction>
```

### 7. **外观模式 (Facade Pattern)**

App 实例作为整个 Vue 系统的外观，封装了内部复杂的组件系统、渲染器、状态管理等：

```typescript
const app: App = (context.app = {
  _uid: uid++,
  _component: rootComponent,
  _context: context,
  // ... 各种方法提供简洁的 API
})
```
        
            
toolName: todo_write
            
status: success
          
Todos updated: 2 items
          
---

## 总结

| 设计模式 | 应用场景 |
|---------|---------|
| **工厂模式** | `createAppAPI` 创建 `createApp` 函数 |
| **构建者模式** | 链式调用 API 设计 |
| **插件模式** | 支持函数/对象两种插件形式 |
| **依赖注入** | `provide` / `inject` 跨组件通信 |
| **策略模式** | `optionMergeStrategies` 自定义合并策略 |
| **外观模式** | App 实例封装内部复杂系统 |

这个文件是 Vue 3 应用创建的入口，通过良好的设计模式组合，实现了灵活、可扩展的应用实例管理机制。