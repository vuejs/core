import {
  isArray,
  isOn,
  hasOwn,
  EMPTY_OBJ,
  capitalize,
  hyphenate
} from '@vue/shared'
import { ComponentInternalInstance } from './component'
import { callWithAsyncErrorHandling, ErrorCodes } from './errorHandling'

export type ObjectEmitsOptions = Record<
  string,
  ((...args: any[]) => any) | null
>
export type EmitsOptions = ObjectEmitsOptions | string[]

type UnionToIntersection<U> = (U extends any
  ? (k: U) => void
  : never) extends ((k: infer I) => void)
  ? I
  : never

export type EmitFn<
  Options = ObjectEmitsOptions,
  Event extends keyof Options = keyof Options
> = Options extends any[]
  ? (event: Options[0], ...args: any[]) => unknown[]
  : UnionToIntersection<
      {
        [key in Event]: Options[key] extends ((...args: infer Args) => any)
          ? (event: key, ...args: Args) => unknown[]
          : (event: key, ...args: any[]) => unknown[]
      }[Event]
    >

export function emit(
  instance: ComponentInternalInstance,
  event: string,
  ...args: any[]
): any[] {
  const props = instance.vnode.props || EMPTY_OBJ
  let handler = props[`on${event}`] || props[`on${capitalize(event)}`]
  // for v-model update:xxx events, also trigger kebab-case equivalent
  // for props passed via kebab-case
  if (!handler && event.indexOf('update:') === 0) {
    event = hyphenate(event)
    handler = props[`on${event}`] || props[`on${capitalize(event)}`]
  }
  if (handler) {
    const res = callWithAsyncErrorHandling(
      handler,
      instance,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args
    )
    return isArray(res) ? res : [res]
  } else {
    return []
  }
}

export function normalizeEmitsOptions(
  options: EmitsOptions | undefined
): ObjectEmitsOptions | undefined {
  if (!options) {
    return
  } else if (isArray(options)) {
    if ((options as any)._n) {
      return (options as any)._n
    }
    const normalized: ObjectEmitsOptions = {}
    options.forEach(key => (normalized[key] = null))
    Object.defineProperty(options, '_n', { value: normalized })
    return normalized
  } else {
    return options
  }
}

// Check if an incoming prop key is a declared emit event listener.
// e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
// both considered matched listeners.
export function isEmitListener(
  emits: ObjectEmitsOptions,
  key: string
): boolean {
  return (
    isOn(key) &&
    (hasOwn(emits, key[2].toLowerCase() + key.slice(3)) ||
      hasOwn(emits, key.slice(2)))
  )
}
