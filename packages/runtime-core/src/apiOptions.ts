import {
  ComponentInstance,
  Data,
  ComponentOptions,
  ComponentRenderProxy
} from './component'
import {
  isFunction,
  extend,
  isString,
  isObject,
  isArray,
  EMPTY_OBJ
} from '@vue/shared'
import { computed, ComputedOptions } from './apiReactivity'
import { watch, WatchOptions } from './apiWatch'
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
import { DebuggerEvent } from '@vue/reactivity'

type LegacyComponent =
  | ComponentOptions
  | {
      new (): ComponentRenderProxy
      options: ComponentOptions
    }

// TODO type inference for these options
export interface LegacyOptions {
  el?: any

  // state
  data?: Data | (() => Data)
  computed?: Record<string, (() => any) | ComputedOptions>
  methods?: Record<string, Function>
  // TODO watch array
  watch?: Record<
    string,
    | string
    | Function
    | { handler: Function; deep?: boolean; immediate: boolean }
  >
  provide?: Data | (() => Data)
  inject?:
    | string[]
    | Record<
        string | symbol,
        string | symbol | { from: string | symbol; default: any }
      >

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
  decativated?(): void
  beforeDestroy?(): void
  destroyed?(): void
  renderTracked?(e: DebuggerEvent): void
  renderTriggered?(e: DebuggerEvent): void
  errorCaptured?(): boolean
}

export function processOptions(instance: ComponentInstance) {
  const data =
    instance.data === EMPTY_OBJ ? (instance.data = {}) : instance.data
  const ctx = instance.renderProxy as any
  const {
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    // beforeCreate is handled separately
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    // TODO activated
    // TODO decativated
    beforeDestroy,
    destroyed,
    renderTracked,
    renderTriggered,
    errorCaptured
  } = instance.type as ComponentOptions

  if (dataOptions) {
    extend(data, isFunction(dataOptions) ? dataOptions.call(ctx) : dataOptions)
  }

  if (computedOptions) {
    for (const key in computedOptions) {
      data[key] = computed(computedOptions[key] as any)
    }
  }

  if (methods) {
    for (const key in methods) {
      data[key] = methods[key].bind(ctx)
    }
  }

  if (watchOptions) {
    for (const key in watchOptions) {
      const raw = watchOptions[key]
      const getter = () => ctx[key]
      if (isString(raw)) {
        const handler = data[key]
        if (isFunction(handler)) {
          watch(getter, handler.bind(ctx))
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

  if (created) {
    created.call(ctx)
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
  if (beforeDestroy) {
    onBeforeUnmount(beforeDestroy.bind(ctx))
  }
  if (destroyed) {
    onUnmounted(destroyed.bind(ctx))
  }
}

export function legacyWatch(
  this: ComponentInstance,
  source: string | Function,
  cb: Function,
  options?: WatchOptions
): () => void {
  const ctx = this.renderProxy as any
  const getter = isString(source) ? () => ctx[source] : source.bind(ctx)
  const stop = watch(getter, cb.bind(ctx), options)
  onBeforeMount(stop, this)
  return stop
}
