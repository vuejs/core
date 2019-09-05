import {
  ComponentInstance,
  Data,
  ComponentOptions,
  currentRenderingInstance,
  currentInstance,
  ComponentRenderProxy
} from './component'
import {
  isFunction,
  extend,
  isString,
  isObject,
  isArray,
  EMPTY_OBJ,
  capitalize,
  camelize
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
  onUnmounted
} from './apiLifecycle'
import { DebuggerEvent, reactive } from '@vue/reactivity'
import { warn } from './warning'

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

export type ExtracComputedReturns<T extends any> = {
  [key in keyof T]: T[key] extends { get: Function }
    ? ReturnType<T[key]['get']>
    : ReturnType<T[key]>
}

type WatchHandler = (
  val: any,
  oldVal: any,
  onCleanup: CleanupRegistrator
) => void

// TODO type inference for these options
export interface LegacyOptions<
  Props,
  RawBindings,
  D,
  C extends ComputedOptions,
  M extends MethodOptions,
  ThisContext = ThisType<ComponentRenderProxy<Props, D, RawBindings, C, M>>
> {
  el?: any

  // state
  data?:
    | D
    | (<This extends ComponentRenderProxy<Props, {}, RawBindings>>(
        this: This
      ) => D)
  computed?: C & ThisContext
  methods?: M & ThisContext
  // TODO watch array
  watch?: Record<
    string,
    string | WatchHandler | { handler: WatchHandler } & WatchOptions
  > &
    ThisContext
  provide?:
    | Data
    | (<This extends ComponentRenderProxy<Props, D, RawBindings, C, M>>(
        this: This
      ) => any)
  inject?:
    | string[]
    | Record<
        string | symbol,
        string | symbol | { from: string | symbol; default?: any }
      >

  // composition
  mixins?: LegacyComponent[]
  extends?: LegacyComponent

  // lifecycle
  beforeCreate?(this: ComponentRenderProxy): void
  created?<This extends ComponentRenderProxy<Props, D, RawBindings, C, M>>(
    this: This
  ): void
  beforeMount?(): void
  mounted?(): void
  beforeUpdate?(): void
  updated?(): void
  activated?(): void
  decativated?(): void
  beforeUnmount?(): void
  unmounted?(): void
  renderTracked?(e: DebuggerEvent): void
  renderTriggered?(e: DebuggerEvent): void
  errorCaptured?(): boolean | void
}

export function applyOptions(
  instance: ComponentInstance,
  options: ComponentOptions,
  asMixin: boolean = false
) {
  const data =
    instance.data === EMPTY_OBJ ? (instance.data = reactive({})) : instance.data
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
    // TODO decativated
    beforeUnmount,
    unmounted,
    renderTracked,
    renderTriggered,
    errorCaptured
  } = options

  const globalMixins = instance.appContext.mixins

  // beforeCreate
  if (!asMixin) {
    callSyncHook('beforeCreate', options, ctx, globalMixins)
  }

  // global mixins are applied first, and only if this is a non-mixin call
  // so that they are applied once per instance.
  if (!asMixin) {
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
    extend(data, isFunction(dataOptions) ? dataOptions.call(ctx) : dataOptions)
  }
  if (computedOptions) {
    for (const key in computedOptions) {
      const opt = (computedOptions as ComputedOptions)[key]
      data[key] = isFunction(opt)
        ? computed(opt.bind(ctx))
        : computed({
            get: opt.get.bind(ctx),
            set: opt.set.bind(ctx)
          })
    }
  }
  if (methods) {
    for (const key in methods) {
      data[key] = (methods as MethodOptions)[key].bind(ctx)
    }
  }
  if (watchOptions) {
    for (const key in watchOptions) {
      const raw = watchOptions[key]
      const getter = () => ctx[key]
      if (isString(raw)) {
        const handler = data[raw]
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
        data[key] = inject(key)
      }
    } else {
      for (const key in injectOptions) {
        const opt = injectOptions[key]
        if (isObject(opt)) {
          data[key] = inject(opt.from, opt.default)
        } else {
          data[key] = inject(opt)
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
    onRenderTracked(renderTriggered.bind(ctx))
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

function applyMixins(instance: ComponentInstance, mixins: ComponentOptions[]) {
  for (let i = 0; i < mixins.length; i++) {
    applyOptions(instance, mixins[i], true)
  }
}

export function resolveAsset(type: 'components' | 'directives', name: string) {
  const instance = currentRenderingInstance || currentInstance
  if (instance) {
    let camelized
    const registry = instance[type]
    const res =
      registry[name] ||
      registry[(camelized = camelize(name))] ||
      registry[capitalize(camelized)]
    if (__DEV__ && !res) {
      warn(`Failed to resolve ${type.slice(0, -1)}: ${name}`)
    }
    return res
  } else if (__DEV__) {
    warn(
      `resolve${capitalize(type.slice(0, -1))} ` +
        `can only be used in render() or setup().`
    )
  }
}
