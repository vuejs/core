import {
  ComponentInternalInstance,
  Data,
  SetupContext,
  RenderFunction,
  SFCInternalOptions,
  PublicAPIComponent,
  Component
} from './component'
import {
  isFunction,
  extend,
  isString,
  isObject,
  isArray,
  EMPTY_OBJ,
  NOOP,
  hasOwn
} from '@vue/shared'
import { computed } from './apiComputed'
import { watch, WatchOptions, WatchCallback } from './apiWatch'
import { provide, inject } from './apiInject'
import {
  onBeforeMount,
  onMounted,
  onBeforeUpdate,
  onUpdated,
  onErrorCaptured,
  onRenderTracked,
  onBeforeUnmount,
  onUnmounted,
  onActivated,
  onDeactivated,
  onRenderTriggered,
  DebuggerHook,
  ErrorCapturedHook
} from './apiLifecycle'
import {
  reactive,
  ComputedGetter,
  WritableComputedOptions,
  ComputedRef
} from '@vue/reactivity'
import {
  ComponentObjectPropsOptions,
  ExtractPropTypes,
  normalizePropsOptions
} from './componentProps'
import { EmitsOptions } from './componentEmits'
import { Directive } from './directives'
import { ComponentPublicInstance } from './componentProxy'
import { warn } from './warning'

export interface ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  E extends EmitsOptions,
  EE extends string = string
> extends LegacyOptions<Props, D, C, M>, SFCInternalOptions {
  setup?: (
    this: void,
    props: Props,
    ctx: SetupContext<E>
  ) => RawBindings | RenderFunction | void
  name?: string
  template?: string | object // can be a direct DOM node
  // Note: we are intentionally using the signature-less `Function` type here
  // since any type with signature will cause the whole inference to fail when
  // the return expression contains reference to `this`.
  // Luckily `render()` doesn't need any arguments nor does it care about return
  // type.
  render?: Function
  // SSR only. This is produced by compiler-ssr and attached in compiler-sfc
  // not user facing, so the typing is lax and for test only.
  ssrRender?: (
    ctx: any,
    push: (item: any) => void,
    parentInstance: ComponentInternalInstance
  ) => void
  components?: Record<string, PublicAPIComponent>
  directives?: Record<string, Directive>
  inheritAttrs?: boolean
  emits?: E | EE[]

  // Internal ------------------------------------------------------------------

  // marker for AsyncComponentWrapper
  __asyncLoader?: () => Promise<Component>
  // cache for merged $options
  __merged?: ComponentOptions

  // type-only differentiator to separate OptionWithoutProps from a constructor
  // type returned by defineComponent() or FunctionalComponent
  call?: never
  // type-only differentiators for built-in Vnode types
  __isFragment?: never
  __isTeleport?: never
  __isSuspense?: never
}

export type ComponentOptionsWithoutProps<
  Props = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string
> = ComponentOptionsBase<Props, RawBindings, D, C, M, E, EE> & {
  props?: undefined
} & ThisType<
    ComponentPublicInstance<{}, RawBindings, D, C, M, E, Readonly<Props>>
  >

export type ComponentOptionsWithArrayProps<
  PropNames extends string = string,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  Props = Readonly<{ [key in PropNames]?: any }>
> = ComponentOptionsBase<Props, RawBindings, D, C, M, E, EE> & {
  props: PropNames[]
} & ThisType<ComponentPublicInstance<Props, RawBindings, D, C, M, E>>

export type ComponentOptionsWithObjectProps<
  PropsOptions = ComponentObjectPropsOptions,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  Props = Readonly<ExtractPropTypes<PropsOptions>>
> = ComponentOptionsBase<Props, RawBindings, D, C, M, E, EE> & {
  props: PropsOptions
} & ThisType<ComponentPublicInstance<Props, RawBindings, D, C, M, E>>

export type ComponentOptions =
  | ComponentOptionsWithoutProps<any, any, any, any, any>
  | ComponentOptionsWithObjectProps<any, any, any, any, any>
  | ComponentOptionsWithArrayProps<any, any, any, any, any>

export type ComputedOptions = Record<
  string,
  ComputedGetter<any> | WritableComputedOptions<any>
>

export interface MethodOptions {
  [key: string]: Function
}

export type ExtractComputedReturns<T extends any> = {
  [key in keyof T]: T[key] extends { get: Function }
    ? ReturnType<T[key]['get']>
    : ReturnType<T[key]>
}

type WatchOptionItem =
  | string
  | WatchCallback
  | { handler: WatchCallback } & WatchOptions

type ComponentWatchOptionItem = WatchOptionItem | WatchOptionItem[]

type ComponentWatchOptions = Record<string, ComponentWatchOptionItem>

type ComponentInjectOptions =
  | string[]
  | Record<
      string | symbol,
      string | symbol | { from: string | symbol; default?: unknown }
    >

export interface LegacyOptions<
  Props,
  D,
  C extends ComputedOptions,
  M extends MethodOptions
> {
  // allow any custom options
  [key: string]: any

  // state
  // Limitation: we cannot expose RawBindings on the `this` context for data
  // since that leads to some sort of circular inference and breaks ThisType
  // for the entire component.
  data?: (
    this: ComponentPublicInstance<Props>,
    vm: ComponentPublicInstance<Props>
  ) => D
  computed?: C
  methods?: M
  watch?: ComponentWatchOptions
  provide?: Data | Function
  inject?: ComponentInjectOptions

  // composition
  mixins?: ComponentOptions[]
  extends?: ComponentOptions

  // lifecycle
  beforeCreate?(): void
  created?(): void
  beforeMount?(): void
  mounted?(): void
  beforeUpdate?(): void
  updated?(): void
  activated?(): void
  deactivated?(): void
  beforeUnmount?(): void
  unmounted?(): void
  renderTracked?: DebuggerHook
  renderTriggered?: DebuggerHook
  errorCaptured?: ErrorCapturedHook
}

const enum OptionTypes {
  PROPS = 'Props',
  DATA = 'Data',
  COMPUTED = 'Computed',
  METHODS = 'Methods',
  INJECT = 'Inject'
}

function createDuplicateChecker() {
  const cache = Object.create(null)
  return (type: OptionTypes, key: string) => {
    if (cache[key]) {
      warn(`${type} property "${key}" is already defined in ${cache[key]}.`)
    } else {
      cache[key] = type
    }
  }
}

export function applyOptions(
  instance: ComponentInternalInstance,
  options: ComponentOptions,
  asMixin: boolean = false
) {
  const proxyTarget = instance.proxyTarget
  const ctx = instance.proxy!
  const {
    // composition
    mixins,
    extends: extendsOptions,
    // state
    props: propsOptions,
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    // assets
    components,
    directives,
    // lifecycle
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    activated,
    deactivated,
    beforeUnmount,
    unmounted,
    renderTracked,
    renderTriggered,
    errorCaptured
  } = options

  const renderContext =
    instance.renderContext === EMPTY_OBJ &&
    (computedOptions || methods || watchOptions || injectOptions)
      ? (instance.renderContext = reactive({}))
      : instance.renderContext

  const globalMixins = instance.appContext.mixins
  // call it only during dev

  // applyOptions is called non-as-mixin once per instance
  if (!asMixin) {
    callSyncHook('beforeCreate', options, ctx, globalMixins)
    // global mixins are applied first
    applyMixins(instance, globalMixins)
  }
  // extending a base component...
  if (extendsOptions) {
    applyOptions(instance, extendsOptions, true)
  }
  // local mixins
  if (mixins) {
    applyMixins(instance, mixins)
  }

  const checkDuplicateProperties = __DEV__ ? createDuplicateChecker() : null

  if (__DEV__ && propsOptions) {
    for (const key in normalizePropsOptions(propsOptions)[0]) {
      checkDuplicateProperties!(OptionTypes.PROPS, key)
    }
  }

  // state options
  if (dataOptions) {
    if (__DEV__ && !isFunction(dataOptions)) {
      warn(
        `The data option must be a function. ` +
          `Plain object usage is no longer supported.`
      )
    }
    const data = dataOptions.call(ctx, ctx)
    if (!isObject(data)) {
      __DEV__ && warn(`data() should return an object.`)
    } else if (instance.data === EMPTY_OBJ) {
      if (__DEV__) {
        for (const key in data) {
          checkDuplicateProperties!(OptionTypes.DATA, key)
          if (!(key in proxyTarget)) proxyTarget[key] = data[key]
        }
      }
      instance.data = reactive(data)
    } else {
      // existing data: this is a mixin or extends.
      extend(instance.data, data)
    }
  }

  if (computedOptions) {
    for (const key in computedOptions) {
      const opt = (computedOptions as ComputedOptions)[key]
      if (isFunction(opt)) {
        renderContext[key] = computed(opt.bind(ctx, ctx))
      } else {
        const { get, set } = opt
        if (isFunction(get)) {
          renderContext[key] = computed({
            get: get.bind(ctx, ctx),
            set: isFunction(set)
              ? set.bind(ctx)
              : __DEV__
                ? () => {
                    warn(
                      `Computed property "${key}" was assigned to but it has no setter.`
                    )
                  }
                : NOOP
          })
        } else if (__DEV__) {
          warn(`Computed property "${key}" has no getter.`)
        }
      }
      if (__DEV__) {
        checkDuplicateProperties!(OptionTypes.COMPUTED, key)
        if (renderContext[key] && !(key in proxyTarget)) {
          Object.defineProperty(proxyTarget, key, {
            enumerable: true,
            get: () => (renderContext[key] as ComputedRef).value
          })
        }
      }
    }
  }

  if (methods) {
    for (const key in methods) {
      const methodHandler = (methods as MethodOptions)[key]
      if (isFunction(methodHandler)) {
        renderContext[key] = methodHandler.bind(ctx)
        if (__DEV__) {
          checkDuplicateProperties!(OptionTypes.METHODS, key)
          if (!(key in proxyTarget)) {
            proxyTarget[key] = renderContext[key]
          }
        }
      } else if (__DEV__) {
        warn(
          `Method "${key}" has type "${typeof methodHandler}" in the component definition. ` +
            `Did you reference the function correctly?`
        )
      }
    }
  }

  if (watchOptions) {
    for (const key in watchOptions) {
      createWatcher(watchOptions[key], renderContext, ctx, key)
    }
  }

  if (provideOptions) {
    const provides = isFunction(provideOptions)
      ? provideOptions.call(ctx)
      : provideOptions
    for (const key in provides) {
      provide(key, provides[key])
    }
  }

  if (injectOptions) {
    if (isArray(injectOptions)) {
      for (let i = 0; i < injectOptions.length; i++) {
        const key = injectOptions[i]
        renderContext[key] = inject(key)
        if (__DEV__) {
          checkDuplicateProperties!(OptionTypes.INJECT, key)
          proxyTarget[key] = renderContext[key]
        }
      }
    } else {
      for (const key in injectOptions) {
        const opt = injectOptions[key]
        if (isObject(opt)) {
          renderContext[key] = inject(opt.from, opt.default)
        } else {
          renderContext[key] = inject(opt)
        }
        if (__DEV__) {
          checkDuplicateProperties!(OptionTypes.INJECT, key)
          proxyTarget[key] = renderContext[key]
        }
      }
    }
  }

  // asset options
  if (components) {
    extend(instance.components, components)
  }
  if (directives) {
    extend(instance.directives, directives)
  }

  // lifecycle options
  if (!asMixin) {
    callSyncHook('created', options, ctx, globalMixins)
  }
  if (beforeMount) {
    onBeforeMount(beforeMount.bind(ctx))
  }
  if (mounted) {
    onMounted(mounted.bind(ctx))
  }
  if (beforeUpdate) {
    onBeforeUpdate(beforeUpdate.bind(ctx))
  }
  if (updated) {
    onUpdated(updated.bind(ctx))
  }
  if (activated) {
    onActivated(activated.bind(ctx))
  }
  if (deactivated) {
    onDeactivated(deactivated.bind(ctx))
  }
  if (errorCaptured) {
    onErrorCaptured(errorCaptured.bind(ctx))
  }
  if (renderTracked) {
    onRenderTracked(renderTracked.bind(ctx))
  }
  if (renderTriggered) {
    onRenderTriggered(renderTriggered.bind(ctx))
  }
  if (beforeUnmount) {
    onBeforeUnmount(beforeUnmount.bind(ctx))
  }
  if (unmounted) {
    onUnmounted(unmounted.bind(ctx))
  }
}

function callSyncHook(
  name: 'beforeCreate' | 'created',
  options: ComponentOptions,
  ctx: ComponentPublicInstance,
  globalMixins: ComponentOptions[]
) {
  callHookFromMixins(name, globalMixins, ctx)
  const baseHook = options.extends && options.extends[name]
  if (baseHook) {
    baseHook.call(ctx)
  }
  const mixins = options.mixins
  if (mixins) {
    callHookFromMixins(name, mixins, ctx)
  }
  const selfHook = options[name]
  if (selfHook) {
    selfHook.call(ctx)
  }
}

function callHookFromMixins(
  name: 'beforeCreate' | 'created',
  mixins: ComponentOptions[],
  ctx: ComponentPublicInstance
) {
  for (let i = 0; i < mixins.length; i++) {
    const fn = mixins[i][name]
    if (fn) {
      fn.call(ctx)
    }
  }
}

function applyMixins(
  instance: ComponentInternalInstance,
  mixins: ComponentOptions[]
) {
  for (let i = 0; i < mixins.length; i++) {
    applyOptions(instance, mixins[i], true)
  }
}

function createWatcher(
  raw: ComponentWatchOptionItem,
  renderContext: Data,
  ctx: ComponentPublicInstance,
  key: string
) {
  const getter = () => (ctx as Data)[key]
  if (isString(raw)) {
    const handler = renderContext[raw]
    if (isFunction(handler)) {
      watch(getter, handler as WatchCallback)
    } else if (__DEV__) {
      warn(`Invalid watch handler specified by key "${raw}"`, handler)
    }
  } else if (isFunction(raw)) {
    watch(getter, raw.bind(ctx))
  } else if (isObject(raw)) {
    if (isArray(raw)) {
      raw.forEach(r => createWatcher(r, renderContext, ctx, key))
    } else {
      watch(getter, raw.handler.bind(ctx), raw)
    }
  } else if (__DEV__) {
    warn(`Invalid watch option: "${key}"`)
  }
}

export function resolveMergedOptions(
  instance: ComponentInternalInstance
): ComponentOptions {
  const raw = instance.type as ComponentOptions
  const { __merged, mixins, extends: extendsOptions } = raw
  if (__merged) return __merged
  const globalMixins = instance.appContext.mixins
  if (!globalMixins.length && !mixins && !extendsOptions) return raw
  const options = {}
  globalMixins.forEach(m => mergeOptions(options, m, instance))
  extendsOptions && mergeOptions(options, extendsOptions, instance)
  mixins && mixins.forEach(m => mergeOptions(options, m, instance))
  mergeOptions(options, raw, instance)
  return (raw.__merged = options)
}

function mergeOptions(to: any, from: any, instance: ComponentInternalInstance) {
  const strats = instance.appContext.config.optionMergeStrategies
  for (const key in from) {
    const strat = strats && strats[key]
    if (strat) {
      to[key] = strat(to[key], from[key], instance.proxy, key)
    } else if (!hasOwn(to, key)) {
      to[key] = from[key]
    }
  }
}
