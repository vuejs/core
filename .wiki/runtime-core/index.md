# 1. runtime-core 运行时核心导出的所有变量， 函数， ts 类型都有哪些？按分类列举一下

现在我已经获取了 runtime-core 的主要导出文件内容，我需要按照分类整理其导出的变量、函数和 TypeScript 类型。让我分析一下文件结构并进行分类。
   
# runtime-core 运行时核心导出内容分类汇总

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