import {
  ComponentInstance,
  Data,
  ComponentOptions,
  currentRenderingInstance,
  currentInstance
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
import { computed, ComputedOptions } from './apiReactivity'
import { watch } from './apiWatch'
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
import { warn } from './warning'

// TODO legacy component definition also supports constructors with .options
type LegacyComponent = ComponentOptions

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
  errorCaptured?(): boolean | void
}

export function applyOptions(
  instance: ComponentInstance,
  options: ComponentOptions,
  asMixin: boolean = false
) {
  const data =
    instance.data === EMPTY_OBJ ? (instance.data = {}) : instance.data
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
  } = options

  // global mixins are applied first, and only if this is a non-mixin call
  // so that they are applied once per instance.
  if (!asMixin) {
    applyMixins(instance, instance.appContext.mixins)
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

  // asset options
  if (components) {
    extend(instance.components, components)
  }
  if (directives) {
    extend(instance.directives, directives)
  }

  // lifecycle options
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
