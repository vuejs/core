import { EmitFn, EmitsOptions } from './componentEmits'
import { ComponentObjectPropsOptions, ExtractPropTypes } from './componentProps'
import { Slots } from './componentSlots'
import { Directive } from './directives'
import { warn } from './warning'

interface DefaultContext {
  props: {}
  attrs: Record<string, unknown>
  emit: (...args: any[]) => void
  slots: Slots
}

interface InferredContext<P, E> {
  props: Readonly<P>
  attrs: Record<string, unknown>
  emit: EmitFn<E>
  slots: Slots
}

type InferContext<T extends Partial<DefaultContext>, P, E> = {
  [K in keyof DefaultContext]: T[K] extends {} ? T[K] : InferredContext<P, E>[K]
}

/**
 * This is a subset of full options that are still useful in the context of
 * <script setup>. Technically, other options can be used too, but are
 * discouraged - if using TypeScript, we nudge users away from doing so by
 * disallowing them in types.
 */
interface Options<E extends EmitsOptions, EE extends string> {
  emits?: E | EE[]
  name?: string
  inhertiAttrs?: boolean
  directives?: Record<string, Directive>
}

/**
 * Compile-time-only helper used for declaring options and retrieving props
 * and the setup context inside `<script setup>`.
 * This is stripped away in the compiled code and should never be actually
 * called at runtime.
 */
// overload 1: no props
export function defineOptions<
  T extends Partial<DefaultContext> = {},
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string
>(
  options?: Options<E, EE> & {
    props?: undefined
  }
): InferContext<T, {}, E>

// overload 2: object props
export function defineOptions<
  T extends Partial<DefaultContext> = {},
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  PP extends string = string,
  P = Readonly<{ [key in PP]?: any }>
>(
  options?: Options<E, EE> & {
    props?: PP[]
  }
): InferContext<T, P, E>

// overload 3: object props
export function defineOptions<
  T extends Partial<DefaultContext> = {},
  E extends EmitsOptions = EmitsOptions,
  EE extends string = string,
  PP extends ComponentObjectPropsOptions = ComponentObjectPropsOptions,
  P = ExtractPropTypes<PP>
>(
  options?: Options<E, EE> & {
    props?: PP
  }
): InferContext<T, P, E>

// implementation
export function defineOptions() {
  if (__DEV__) {
    warn(
      `defineContext() is a compiler-hint helper that is only usable inside ` +
        `<script setup> of a single file component. It will be compiled away ` +
        `and should not be used in final distributed code.`
    )
  }
  return 0 as any
}
