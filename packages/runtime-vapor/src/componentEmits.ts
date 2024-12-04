import {
  type UnionToIntersection,
  camelize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
  isOn,
  isString,
  looseToNumber,
  toHandlerKey,
} from '@vue/shared'
import type { Component, ComponentInternalInstance } from './component'
import { VaporErrorCodes, callWithAsyncErrorHandling } from './errorHandling'
import { type StaticProps, getDynamicPropValue } from './componentProps'
import { warn } from './warning'

export type ObjectEmitsOptions = Record<
  string,
  ((...args: any[]) => any) | null // TODO: call validation?
>

export type EmitsOptions = ObjectEmitsOptions | string[]

export type EmitFn<
  Options = ObjectEmitsOptions,
  Event extends keyof Options = keyof Options,
> =
  Options extends Array<infer V>
    ? (event: V, ...args: any[]) => void
    : {} extends Options // if the emit is empty object (usually the default value for emit) should be converted to function
      ? (event: string, ...args: any[]) => void
      : UnionToIntersection<
          {
            [key in Event]: Options[key] extends (...args: infer Args) => any
              ? (event: key, ...args: Args) => void
              : (event: key, ...args: any[]) => void
          }[Event]
        >

export function emit(
  instance: ComponentInternalInstance,
  event: string,
  ...rawArgs: any[]
): void {
  if (instance.isUnmounted) return

  if (__DEV__) {
    const {
      emitsOptions,
      propsOptions: [propsOptions],
    } = instance
    if (emitsOptions) {
      if (!(event in emitsOptions)) {
        if (!propsOptions || !(toHandlerKey(event) in propsOptions)) {
          warn(
            `Component emitted event "${event}" but it is neither declared in ` +
              `the emits option nor as an "${toHandlerKey(event)}" prop.`,
          )
        }
      } else {
        const validator = emitsOptions[event]
        if (isFunction(validator)) {
          const isValid = validator(...rawArgs)
          if (!isValid) {
            warn(
              `Invalid event arguments: event validation failed for event "${event}".`,
            )
          }
        }
      }
    }
  }

  const { rawProps } = instance
  const hasDynamicProps = rawProps.some(isFunction)

  let handlerName: string
  let handler: any
  let onceHandler: any

  const isModelListener = event.startsWith('update:')
  const modelArg = isModelListener && event.slice(7)
  let modifiers: any

  // has v-bind or :[eventName]
  if (hasDynamicProps) {
    tryGet(key => getDynamicPropValue(rawProps, key)[0])
  } else {
    const staticProps = rawProps[0] as StaticProps
    tryGet(key => staticProps[key] && staticProps[key]())
  }

  function tryGet(getter: (key: string) => any) {
    handler =
      getter((handlerName = toHandlerKey(event))) ||
      // also try camelCase event handler (#2249)
      getter((handlerName = toHandlerKey(camelize(event))))
    // for v-model update:xxx events, also trigger kebab-case equivalent
    // for props passed via kebab-case
    if (!handler && isModelListener) {
      handler = getter((handlerName = toHandlerKey(hyphenate(event))))
    }
    onceHandler = getter(`${handlerName}Once`)
    modifiers =
      modelArg &&
      getter(`${modelArg === 'modelValue' ? 'model' : modelArg}Modifiers`)
  }

  // for v-model update:xxx events, apply modifiers on args
  let args = rawArgs
  if (modifiers) {
    const { number, trim } = modifiers
    if (trim) {
      args = rawArgs.map(a => (isString(a) ? a.trim() : a))
    }
    if (number) {
      args = rawArgs.map(looseToNumber)
    }
  }

  // TODO: warn

  if (handler) {
    callWithAsyncErrorHandling(
      handler,
      instance,
      VaporErrorCodes.COMPONENT_EVENT_HANDLER,
      args,
    )
  }

  if (onceHandler) {
    if (!instance.emitted) {
      instance.emitted = {}
    } else if (instance.emitted[handlerName!]) {
      return
    }
    instance.emitted[handlerName!] = true
    callWithAsyncErrorHandling(
      onceHandler,
      instance,
      VaporErrorCodes.COMPONENT_EVENT_HANDLER,
      args,
    )
  }
}

export function normalizeEmitsOptions(
  comp: Component,
): ObjectEmitsOptions | null {
  // TODO: caching?

  const raw = comp.emits
  if (!raw) return null

  let normalized: ObjectEmitsOptions = {}
  if (isArray(raw)) {
    raw.forEach(key => (normalized[key] = null))
  } else {
    extend(normalized, raw)
  }

  return normalized
}

// Check if an incoming prop key is a declared emit event listener.
// e.g. With `emits: { click: null }`, props named `onClick` and `onclick` are
// both considered matched listeners.
export function isEmitListener(
  options: ObjectEmitsOptions | null,
  key: string,
): boolean {
  if (!options || !isOn(key)) {
    return false
  }

  key = key.slice(2).replace(/Once$/, '')
  return (
    hasOwn(options, key[0].toLowerCase() + key.slice(1)) ||
    hasOwn(options, hyphenate(key)) ||
    hasOwn(options, key)
  )
}
