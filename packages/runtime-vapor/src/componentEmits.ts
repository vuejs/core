// NOTE: runtime-core/src/componentEmits.ts

import {
  EMPTY_OBJ,
  type UnionToIntersection,
  camelize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isOn,
  isString,
  looseToNumber,
  toHandlerKey,
} from '@vue/shared'
import type { Component, ComponentInternalInstance } from './component'
import { VaporErrorCodes, callWithAsyncErrorHandling } from './errorHandling'

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
) {
  if (instance.isUnmounted) return
  const { rawProps } = instance

  let args = rawArgs
  const isModelListener = event.startsWith('update:')

  // for v-model update:xxx events, apply modifiers on args
  const modelArg = isModelListener && event.slice(7)

  if (modelArg && modelArg in rawProps) {
    const modifiersKey = `${
      modelArg === 'modelValue' ? 'model' : modelArg
    }Modifiers`
    const { number, trim } = rawProps[modifiersKey] || EMPTY_OBJ
    if (trim) {
      args = rawArgs.map(a => (isString(a) ? a.trim() : a))
    }
    if (number) {
      args = rawArgs.map(looseToNumber)
    }
  }

  // TODO: warn

  let handlerName
  let handler =
    rawProps[(handlerName = toHandlerKey(event))] ||
    // also try camelCase event handler (#2249)
    rawProps[(handlerName = toHandlerKey(camelize(event)))]
  // for v-model update:xxx events, also trigger kebab-case equivalent
  // for props passed via kebab-case
  if (!handler && isModelListener) {
    handler = rawProps[(handlerName = toHandlerKey(hyphenate(event)))]
  }

  if (handler) {
    callWithAsyncErrorHandling(
      handler,
      instance,
      VaporErrorCodes.COMPONENT_EVENT_HANDLER,
      args,
    )
  }

  const onceHandler = rawProps[`${handlerName}Once`]
  if (onceHandler) {
    if (!instance.emitted) {
      instance.emitted = {}
    } else if (instance.emitted[handlerName]) {
      return
    }
    instance.emitted[handlerName] = true
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
