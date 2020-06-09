import {
  isArray,
  isOn,
  hasOwn,
  EMPTY_OBJ,
  capitalize,
  hyphenate,
  isFunction,
  def
} from '@vue/shared'
import { ComponentInternalInstance } from './component'
import { callWithAsyncErrorHandling, ErrorCodes } from './errorHandling'
import { warn } from './warning'
import { normalizePropsOptions } from './componentProps'
import { UnionToIntersection } from './helpers/typeUtils'

export type ObjectEmitsOptions = Record<
  string,
  ((...args: any[]) => any) | null
>
export type EmitsOptions = ObjectEmitsOptions | string[]

export type EmitFn<
  Options = ObjectEmitsOptions,
  Event extends keyof Options = keyof Options
> = Options extends any[]
  ? (event: Options[0], ...args: any[]) => void
  : UnionToIntersection<
      {
        [key in Event]: Options[key] extends ((...args: infer Args) => any)
          ? (event: key, ...args: Args) => void
          : (event: key, ...args: any[]) => void
      }[Event]
    >

export function emit(
  instance: ComponentInternalInstance,
  event: string,
  ...args: any[]
) {
  const props = instance.vnode.props || EMPTY_OBJ

  if (__DEV__) {
    const options = normalizeEmitsOptions(instance.type.emits)
    if (options) {
      if (!(event in options)) {
        const propsOptions = normalizePropsOptions(instance.type)[0]
        if (!propsOptions || !(`on` + capitalize(event) in propsOptions)) {
          warn(
            `Component emitted event "${event}" but it is neither declared in ` +
              `the emits option nor as an "on${capitalize(event)}" prop.`
          )
        }
      } else {
        const validator = options[event]
        if (isFunction(validator)) {
          const isValid = validator(...args)
          if (!isValid) {
            warn(
              `Invalid event arguments: event validation failed for event "${event}".`
            )
          }
        }
      }
    }
  }

  let handler = props[`on${capitalize(event)}`]
  // for v-model update:xxx events, also trigger kebab-case equivalent
  // for props passed via kebab-case
  if (!handler && event.startsWith('update:')) {
    event = hyphenate(event)
    handler = props[`on${capitalize(event)}`]
  }
  if (handler) {
    callWithAsyncErrorHandling(
      handler,
      instance,
      ErrorCodes.COMPONENT_EVENT_HANDLER,
      args
    )
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
    def(options, '_n', normalized)
    return normalized
  } else {
    return options
  }
}

// Check if an incoming prop key is a declared emit event listener.
// e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
// both considered matched listeners.
export function isEmitListener(emits: EmitsOptions, key: string): boolean {
  return (
    isOn(key) &&
    (hasOwn(
      (emits = normalizeEmitsOptions(emits) as ObjectEmitsOptions),
      key[2].toLowerCase() + key.slice(3)
    ) ||
      hasOwn(emits, key.slice(2)))
  )
}
