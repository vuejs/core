import { ComponentPropsOptions } from '@vue/runtime-core'
import { isArray, isPromise, isFunction, OptionalPropertyOf } from '@vue/shared'
import {
  getCurrentInstance,
  setCurrentInstance,
  SetupContext,
  createSetupContext,
  unsetCurrentInstance
} from './component'
import { EmitFn, EmitsOptions } from './componentEmits'
import { ComponentObjectPropsOptions, ExtractPropTypes } from './componentProps'
import { warn } from './warning'

// dev only
const warnRuntimeUsage = (method: string) =>
  warn(
    `${method}() is a compiler-hint helper that is only usable inside ` +
      `<script setup> of a single file component. Its arguments should be ` +
      `compiled away and passing it at runtime has no effect.`
  )

/**
 * Vue `<script setup>` compiler macro for declaring component props. The
 * expected argument is the same as the component `props` option.
 *
 * Example runtime declaration:
 * ```js
 * // using Array syntax
 * const props = defineProps(['foo', 'bar'])
 * // using Object syntax
 * const props = defineProps({
 *   foo: String,
 *   bar: {
 *     type: Number,
 *     required: true
 *   }
 * })
 * ```
 *
 * Equivalent type-based declaration:
 * ```ts
 * // will be compiled into equivalent runtime declarations
 * const props = defineProps<{
 *   foo?: string
 *   bar: number
 * }>()
 * ```
 *
 * This is only usable inside `<script setup>`, is compiled away in the
 * output and should **not** be actually called at runtime.
 */
// overload 1: runtime props w/ array
export function defineProps<PropNames extends string = string>(
  props: PropNames[]
): Readonly<{ [key in PropNames]?: any }>
// overload 2: runtime props w/ object
export function defineProps<
  PP extends ComponentObjectPropsOptions = ComponentObjectPropsOptions
>(props: PP): Readonly<ExtractPropTypes<PP>>
// overload 3: typed-based declaration
export function defineProps<T>(): T extends object
  ? {
      // use needed to remove the optional property
      [K in keyof Required<T>]: K extends OptionalPropertyOf<T>
        ? T[K] | undefined
        : T[K]
    }
  : Readonly<T>
// implementation
export function defineProps() {
  if (__DEV__) {
    warnRuntimeUsage(`defineProps`)
  }
  return null as any
}

/**
 * Vue `<script setup>` compiler macro for declaring a component's emitted
 * events. The expected argument is the same as the component `emits` option.
 *
 * Example runtime declaration:
 * ```js
 * const emit = defineEmits(['change', 'update'])
 * ```
 *
 * Example type-based declaration:
 * ```ts
 * const emit = defineEmits<{
 *   (event: 'change'): void
 *   (event: 'update', id: number): void
 * }>()
 *
 * emit('change')
 * emit('update', 1)
 * ```
 *
 * This is only usable inside `<script setup>`, is compiled away in the
 * output and should **not** be actually called at runtime.
 */
// overload 1: runtime emits w/ array
export function defineEmits<EE extends string = string>(
  emitOptions: EE[]
): EmitFn<EE[]>
export function defineEmits<E extends EmitsOptions = EmitsOptions>(
  emitOptions: E
): EmitFn<E>
export function defineEmits<TypeEmit>(): TypeEmit
// implementation
export function defineEmits() {
  if (__DEV__) {
    warnRuntimeUsage(`defineEmits`)
  }
  return null as any
}

/**
 * Vue `<script setup>` compiler macro for declaring a component's exposed
 * instance properties when it is accessed by a parent component via template
 * refs.
 *
 * `<script setup>` components are closed by default - i.e. variables inside
 * the `<script setup>` scope is not exposed to parent unless explicitly exposed
 * via `defineExpose`.
 *
 * This is only usable inside `<script setup>`, is compiled away in the
 * output and should **not** be actually called at runtime.
 */
export function defineExpose<
  Exposed extends Record<string, any> = Record<string, any>
>(exposed?: Exposed) {
  if (__DEV__) {
    warnRuntimeUsage(`defineExpose`)
  }
}

type NotUndefined<T> = T extends undefined ? never : T

type InferDefaults<T> = {
  [K in keyof T]?: InferDefault<T, NotUndefined<T[K]>>
}

type InferDefault<P, T> = T extends
  | null
  | number
  | string
  | boolean
  | symbol
  | Function
  ? T | ((props: P) => T)
  : (props: P) => T

type PropsWithDefaults<Base, Defaults> = Base & {
  [K in keyof Defaults]: K extends keyof Base ? NotUndefined<Base[K]> : never
}

/**
 * Vue `<script setup>` compiler macro for providing props default values when
 * using type-based `defineProps` declaration.
 *
 * Example usage:
 * ```ts
 * withDefaults(defineProps<{
 *   size?: number
 *   labels?: string[]
 * }>(), {
 *   size: 3,
 *   labels: () => ['default label']
 * })
 * ```
 *
 * This is only usable inside `<script setup>`, is compiled away in the output
 * and should **not** be actually called at runtime.
 */
export function withDefaults<Props, Defaults extends InferDefaults<Props>>(
  props: Props,
  defaults: Defaults
): PropsWithDefaults<Props, Defaults> {
  if (__DEV__) {
    warnRuntimeUsage(`withDefaults`)
  }
  return null as any
}

export function useSlots(): SetupContext['slots'] {
  return getContext().slots
}

export function useAttrs(): SetupContext['attrs'] {
  return getContext().attrs
}

function getContext(): SetupContext {
  const i = getCurrentInstance()!
  if (__DEV__ && !i) {
    warn(`useContext() called without active instance.`)
  }
  return i.setupContext || (i.setupContext = createSetupContext(i))
}

/**
 * Runtime helper for merging default declarations. Imported by compiled code
 * only.
 * @internal
 */
export function mergeDefaults(
  raw: ComponentPropsOptions,
  defaults: Record<string, any>
): ComponentObjectPropsOptions {
  const props = isArray(raw)
    ? raw.reduce(
        (normalized, p) => ((normalized[p] = {}), normalized),
        {} as ComponentObjectPropsOptions
      )
    : raw
  for (const key in defaults) {
    const opt = props[key]
    if (opt) {
      if (isArray(opt) || isFunction(opt)) {
        props[key] = { type: opt, default: defaults[key] }
      } else {
        opt.default = defaults[key]
      }
    } else if (opt === null) {
      props[key] = { default: defaults[key] }
    } else if (__DEV__) {
      warn(`props default key "${key}" has no corresponding declaration.`)
    }
  }
  return props
}

/**
 * Used to create a proxy for the rest element when destructuring props with
 * defineProps().
 * @internal
 */
export function createPropsRestProxy(
  props: any,
  excludedKeys: string[]
): Record<string, any> {
  const ret: Record<string, any> = {}
  for (const key in props) {
    if (!excludedKeys.includes(key)) {
      Object.defineProperty(ret, key, {
        enumerable: true,
        get: () => props[key]
      })
    }
  }
  return ret
}

/**
 * `<script setup>` helper for persisting the current instance context over
 * async/await flows.
 *
 * `@vue/compiler-sfc` converts the following:
 *
 * ```ts
 * const x = await foo()
 * ```
 *
 * into:
 *
 * ```ts
 * let __temp, __restore
 * const x = (([__temp, __restore] = withAsyncContext(() => foo())),__temp=await __temp,__restore(),__temp)
 * ```
 * @internal
 */
export function withAsyncContext(getAwaitable: () => any) {
  const ctx = getCurrentInstance()!
  if (__DEV__ && !ctx) {
    warn(
      `withAsyncContext called without active current instance. ` +
        `This is likely a bug.`
    )
  }
  let awaitable = getAwaitable()
  unsetCurrentInstance()
  if (isPromise(awaitable)) {
    awaitable = awaitable.catch(e => {
      setCurrentInstance(ctx)
      throw e
    })
  }
  return [awaitable, () => setCurrentInstance(ctx)]
}
