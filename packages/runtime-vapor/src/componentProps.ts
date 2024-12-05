import { EMPTY_ARR, NO, YES, extend, hasOwn, isFunction } from '@vue/shared'
import type { VaporComponent, VaporComponentInstance } from './component'
import {
  type NormalizedPropsOptions,
  baseNormalizePropsOptions,
  isEmitListener,
  popWarningContext,
  pushWarningContext,
  resolvePropValue,
  validateProps,
} from '@vue/runtime-dom'
import { normalizeEmitsOptions } from './componentEmits'
import { renderEffect } from './renderEffect'

export type RawProps = Record<string, () => unknown> & {
  $?: DynamicPropsSource[]
}

type DynamicPropsSource =
  | (() => Record<string, unknown>)
  | Record<string, () => unknown>

// TODO optimization: maybe convert functions into computeds
export function resolveSource(
  source: Record<string, any> | (() => Record<string, any>),
): Record<string, any> {
  return isFunction(source) ? source() : source
}

const passThrough = (val: any) => val

export function getPropsProxyHandlers(
  comp: VaporComponent,
  instance: VaporComponentInstance,
): [ProxyHandler<RawProps> | null, ProxyHandler<RawProps>] {
  if (comp.__propsHandlers) {
    return comp.__propsHandlers
  }
  const propsOptions = normalizePropsOptions(comp)[0]
  const emitsOptions = normalizeEmitsOptions(comp)
  const isProp = propsOptions ? (key: string) => hasOwn(propsOptions, key) : NO
  const isAttr = propsOptions
    ? (key: string) =>
        key !== '$' && !isProp(key) && !isEmitListener(emitsOptions, key)
    : YES

  const castProp = propsOptions
    ? (value: any, key: string, isAbsent = false) =>
        resolvePropValue(
          propsOptions,
          key as string,
          value,
          instance,
          resolveDefault,
          isAbsent,
        )
    : passThrough

  const getProp = (target: RawProps, key: string, asProp: boolean) => {
    if (asProp) {
      if (!isProp(key) || key === '$') return
    } else if (isProp(key) || isEmitListener(emitsOptions, key)) {
      return
    }
    const dynamicSources = target.$
    if (dynamicSources) {
      let i = dynamicSources.length
      let source, isDynamic
      while (i--) {
        source = dynamicSources[i]
        isDynamic = isFunction(source)
        source = isDynamic ? (source as Function)() : source
        if (hasOwn(source, key)) {
          return castProp(isDynamic ? source[key] : source[key](), key)
        }
      }
    }
    if (key in target) {
      return castProp(target[key as string](), key)
    }
    return castProp(undefined, key, true)
  }

  const propsHandlers = propsOptions
    ? ({
        get: (target, key: string) => getProp(target, key, true),
        has: (_, key: string) => isProp(key),
        getOwnPropertyDescriptor(target, key: string) {
          if (isProp(key)) {
            return {
              configurable: true,
              enumerable: true,
              get: () => getProp(target, key, true),
            }
          }
        },
        ownKeys: () => Object.keys(propsOptions),
        set: NO,
        deleteProperty: NO,
      } satisfies ProxyHandler<RawProps>)
    : null

  const hasAttr = (target: RawProps, key: string) => {
    if (isAttr(key)) {
      const dynamicSources = target.$
      if (dynamicSources) {
        let i = dynamicSources.length
        while (i--) {
          if (hasOwn(resolveSource(dynamicSources[i]), key)) {
            return true
          }
        }
      }
      return hasOwn(target, key)
    } else {
      return false
    }
  }

  const attrsHandlers = {
    get: (target, key: string) => {
      return getProp(target, key, false)
    },
    has: hasAttr,
    getOwnPropertyDescriptor(target, key: string) {
      if (hasAttr(target, key)) {
        return {
          configurable: true,
          enumerable: true,
          get: () => getProp(target, key, false),
        }
      }
    },
    ownKeys(target) {
      const keys: string[] = []
      for (const key in target) {
        if (isAttr(key)) keys.push(key)
      }
      const dynamicSources = target.$
      if (dynamicSources) {
        let i = dynamicSources.length
        let source
        while (i--) {
          source = resolveSource(dynamicSources[i])
          for (const key in source) {
            if (isAttr(key)) keys.push(key)
          }
        }
      }
      return Array.from(new Set(keys))
    },
    set: NO,
    deleteProperty: NO,
  } satisfies ProxyHandler<RawProps>

  return (comp.__propsHandlers = [propsHandlers, attrsHandlers])
}

export function normalizePropsOptions(
  comp: VaporComponent,
): NormalizedPropsOptions {
  const cached = comp.__propsOptions
  if (cached) return cached

  const raw = comp.props
  if (!raw) return EMPTY_ARR as []

  const normalized: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []
  baseNormalizePropsOptions(raw, normalized, needCastKeys)

  return (comp.__propsOptions = [normalized, needCastKeys])
}

function resolveDefault(
  factory: (props: Record<string, any>) => unknown,
  instance: VaporComponentInstance,
) {
  return factory.call(null, instance.props)
}

export function hasFallthroughAttrs(
  comp: VaporComponent,
  rawProps: RawProps | undefined,
): boolean {
  if (rawProps) {
    // determine fallthrough
    if (rawProps.$ || !comp.props) {
      return true
    } else {
      // check if rawProps contains any keys not declared
      const propsOptions = normalizePropsOptions(comp)[0]
      for (const key in rawProps) {
        if (!hasOwn(propsOptions!, key)) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * dev only
 */
export function setupPropsValidation(instance: VaporComponentInstance): void {
  const rawProps = instance.rawProps
  if (!rawProps) return
  renderEffect(() => {
    const mergedRawProps = extend({}, rawProps)
    if (rawProps.$) {
      for (const source of rawProps.$) {
        const isDynamic = isFunction(source)
        const resolved = isDynamic ? source() : source
        for (const key in resolved) {
          mergedRawProps[key] = isDynamic
            ? resolved[key]
            : (resolved[key] as Function)()
        }
      }
    }
    pushWarningContext(instance)
    validateProps(
      mergedRawProps,
      instance.props,
      normalizePropsOptions(instance.type)[0]!,
    )
    popWarningContext()
  })
}
