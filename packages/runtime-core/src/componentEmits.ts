import {
  isArray,
  isOn,
  hasOwn,
  EMPTY_OBJ,
  capitalize,
  hyphenate,
  isFunction,
  extend
} from '@vue/shared'
import { ComponentInternalInstance, Component } from './component'
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
  : {} extends Options // if the emit is empty object (usually the default value for emit) should be converted to function
    ? (event: string, ...args: any[]) => void
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
    const options = normalizeEmitsOptions(instance.type)
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

  let handlerName = `on${capitalize(event)}`
  let handler = props[handlerName]
  // for v-model update:xxx events, also trigger kebab-case equivalent
  // for props passed via kebab-case
  if (!handler && event.startsWith('update:')) {
    handlerName = `on${capitalize(hyphenate(event))}`
    handler = props[handlerName]
  }
  if (!handler) {
    handler = props[handlerName + `Once`]
    if (!instance.emitted) {
      ;(instance.emitted = {} as Record<string, boolean>)[handlerName] = true
    } else if (instance.emitted[handlerName]) {
      return
    }
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

function normalizeEmitsOptions(
  comp: Component
): ObjectEmitsOptions | undefined {
  if (hasOwn(comp, '__emits')) {
    return comp.__emits
  }

  const raw = comp.emits
  let normalized: ObjectEmitsOptions = {}

  // apply mixin/extends props
  let hasExtends = false
  if (__FEATURE_OPTIONS__ && !isFunction(comp)) {
    if (comp.extends) {
      hasExtends = true
      extend(normalized, normalizeEmitsOptions(comp.extends))
    }
    if (comp.mixins) {
      hasExtends = true
      comp.mixins.forEach(m => extend(normalized, normalizeEmitsOptions(m)))
    }
  }

  if (!raw && !hasExtends) {
    return (comp.__emits = undefined)
  }

  if (isArray(raw)) {
    raw.forEach(key => (normalized[key] = null))
  } else {
    extend(normalized, raw)
  }
  return (comp.__emits = normalized)
}

// Check if an incoming prop key is a declared emit event listener.
// e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
// both considered matched listeners.
export function isEmitListener(comp: Component, key: string): boolean {
  let emits: ObjectEmitsOptions | undefined
  if (!isOn(key) || !(emits = normalizeEmitsOptions(comp))) {
    return false
  }
  key = key.replace(/Once$/, '')
  return (
    hasOwn(emits, key[2].toLowerCase() + key.slice(3)) ||
    hasOwn(emits, key.slice(2))
  )
}
