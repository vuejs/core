import {
  ComponentInternalInstance,
  Data,
  Component,
  SetupContext
} from './component'
import {
  isFunction,
  extend,
  isString,
  isObject,
  isArray,
  EMPTY_OBJ
} from '@vue/shared'
import { computed } from './apiReactivity'
import { watch, WatchOptions, CleanupRegistrator } from './apiWatch'
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
  onRenderTriggered
} from './apiLifecycle'
import { DebuggerEvent, reactive } from '@vue/reactivity'
import { ComponentPropsOptions, ExtractPropTypes } from './componentProps'
import { Directive } from './directives'
import { VNodeChild } from './vnode'
import { ComponentPublicInstance } from './componentProxy'
import { warn } from './warning'

interface ComponentOptionsBase<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions,
  M extends MethodOptions
> extends LegacyOptions<Props, RawBindings, D, C, M> {
  setup?: (
    this: null,
    props: Props,
    ctx: SetupContext
  ) => RawBindings | (() => VNodeChild) | void
  name?: string
  template?: string
  // Note: we are intentionally using the signature-less `Function` type here
  // since any type with signature will cause the whole inference to fail when
  // the return expression contains reference to `this`.
  // Luckily `render()` doesn't need any arguments nor does it care about return
  // type.
  render?: Function
  components?: Record<string, Component>
  directives?: Record<string, Directive>
}

export type ComponentOptionsWithoutProps<
  Props = {},
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {}
> = ComponentOptionsBase<Props, RawBindings, D, C, M> & {
  props?: undefined
} & ThisType<ComponentPublicInstance<Props, RawBindings, D, C, M>>

export type ComponentOptionsWithArrayProps<
  PropNames extends string = string,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Props = { [key in PropNames]?: unknown }
> = ComponentOptionsBase<Props, RawBindings, D, C, M> & {
  props: PropNames[]
} & ThisType<ComponentPublicInstance<Props, RawBindings, D, C, M>>

export type ComponentOptionsWithProps<
  PropsOptions = ComponentPropsOptions,
  RawBindings = {},
  D = {},
  C extends ComputedOptions = {},
  M extends MethodOptions = {},
  Props = ExtractPropTypes<PropsOptions>
> = ComponentOptionsBase<Props, RawBindings, D, C, M> & {
  props: PropsOptions
} & ThisType<ComponentPublicInstance<Props, RawBindings, D, C, M>>

export type ComponentOptions =
  | ComponentOptionsWithoutProps
  | ComponentOptionsWithProps
  | ComponentOptionsWithArrayProps

// TODO legacy component definition also supports constructors with .options
type LegacyComponent = ComponentOptions

export interface ComputedOptions {
  [key: string]:
    | Function
    | {
        get: Function
        set: Function
      }
}

export interface MethodOptions {
  [key: string]: Function
}

export type ExtractComputedReturns<T extends any> = {
  [key in keyof T]: T[key] extends { get: Function }
    ? ReturnType<T[key]['get']>
    : ReturnType<T[key]>
}

type WatchHandler = (
  val: any,
  oldVal: any,
  onCleanup: CleanupRegistrator
) => void

type ComponentWatchOptions = Record<
  string,
  string | WatchHandler | { handler: WatchHandler } & WatchOptions
>

type ComponentInjectOptions =
  | string[]
  | Record<
      string | symbol,
      string | symbol | { from: string | symbol; default?: any }
    >

// TODO type inference for these options
export interface LegacyOptions<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions,
  M extends MethodOptions
> {
  el?: any

  // state
  // Limitation: we cannot expose RawBindings on the `this` context for data
  // since that leads to some sort of circular inference and breaks ThisType
  // for the entire component.
  data?: D | ((this: ComponentPublicInstance<Props>) => D)
  computed?: C
  methods?: M
  // TODO watch array
  watch?: ComponentWatchOptions
  provide?: Data | Function
  inject?: ComponentInjectOptions

  // composition
  mixins?: LegacyComponent[]
  extends?: LegacyComponent

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
  renderTracked?(e: DebuggerEvent): void
  renderTriggered?(e: DebuggerEvent): void
  errorCaptured?(): boolean | void
}

export function applyOptions(
  instance: ComponentInternalInstance,
  options: ComponentOptions,
  asMixin: boolean = false
) {
  const renderContext =
    instance.renderContext === EMPTY_OBJ
      ? (instance.renderContext = reactive({}))
      : instance.renderContext
  const ctx = instance.renderProxy as any
  const {
    // composition
    mixins,
    extends: extendsOptions,
    // state
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
    // TODO activated
    // TODO deactivated
    beforeUnmount,
    unmounted,
    renderTracked,
    renderTriggered,
    errorCaptured
  } = options

  const globalMixins = instance.appContext.mixins
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

  // state options
  if (dataOptions) {
    const data = isFunction(dataOptions) ? dataOptions.call(ctx) : dataOptions
    if (!isObject(data)) {
      __DEV__ && warn(`data() should return an object.`)
    } else if (instance.data === EMPTY_OBJ) {
      instance.data = reactive(data)
    } else {
      // existing data: this is a mixin or extends.
      extend(instance.data, data)
    }
  }
  if (computedOptions) {
    for (const key in computedOptions) {
      const opt = (computedOptions as ComputedOptions)[key]
      renderContext[key] = isFunction(opt)
        ? computed(opt.bind(ctx))
        : computed({
            get: opt.get.bind(ctx),
            set: opt.set.bind(ctx)
          })
    }
  }
  if (methods) {
    for (const key in methods) {
      renderContext[key] = (methods as MethodOptions)[key].bind(ctx)
    }
  }
  if (watchOptions) {
    for (const key in watchOptions) {
      const raw = watchOptions[key]
      const getter = () => ctx[key]
      if (isString(raw)) {
        const handler = renderContext[raw]
        if (isFunction(handler)) {
          watch(getter, handler as any)
        } else if (__DEV__) {
          // TODO warn invalid watch handler path
        }
      } else if (isFunction(raw)) {
        watch(getter, raw.bind(ctx))
      } else if (isObject(raw)) {
        // TODO 2.x compat
        watch(getter, raw.handler.bind(ctx), raw)
      } else if (__DEV__) {
        // TODO warn invalid watch options
      }
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
      }
    } else {
      for (const key in injectOptions) {
        const opt = injectOptions[key]
        if (isObject(opt)) {
          renderContext[key] = inject(opt.from, opt.default)
        } else {
          renderContext[key] = inject(opt)
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
  ctx: any,
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
  ctx: any
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
