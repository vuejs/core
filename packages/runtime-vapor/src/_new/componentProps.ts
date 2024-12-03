import { EMPTY_ARR, NO, camelize, hasOwn, isFunction } from '@vue/shared'
import type { Component, ComponentInstance } from './component'
import {
  type NormalizedPropsOptions,
  baseNormalizePropsOptions,
  resolvePropValue,
} from '@vue/runtime-core'

export interface RawProps {
  [key: string]: PropSource
  $?: DynamicPropsSource[]
}

type PropSource<T = any> = T | (() => T)

type DynamicPropsSource = PropSource<Record<string, any>>

export function initStaticProps(
  comp: Component,
  rawProps: RawProps | undefined,
  instance: ComponentInstance,
): boolean {
  let hasAttrs = false
  const { props, attrs } = instance
  const [propsOptions, needCastKeys] = normalizePropsOptions(comp)
  // TODO emits filtering
  for (const key in rawProps) {
    const normalizedKey = camelize(key)
    const needCast = needCastKeys && needCastKeys.includes(normalizedKey)
    const source = rawProps[key]
    if (propsOptions && normalizedKey in propsOptions) {
      if (isFunction(source)) {
        Object.defineProperty(props, normalizedKey, {
          enumerable: true,
          get: needCast
            ? () =>
                resolvePropValue(
                  propsOptions,
                  normalizedKey,
                  source(),
                  instance,
                  resolveDefault,
                )
            : source,
        })
      } else {
        props[normalizedKey] = needCast
          ? resolvePropValue(
              propsOptions,
              normalizedKey,
              source,
              instance,
              resolveDefault,
            )
          : source
      }
    } else {
      if (isFunction(source)) {
        Object.defineProperty(attrs, key, {
          enumerable: true,
          get: source,
        })
      } else {
        attrs[normalizedKey] = source
      }
      hasAttrs = true
    }
  }
  for (const key in propsOptions) {
    if (!(key in props)) {
      props[key] = resolvePropValue(
        propsOptions,
        key,
        undefined,
        instance,
        resolveDefault,
        true,
      )
    }
  }
  return hasAttrs
}

function resolveDefault(
  factory: (props: Record<string, any>) => unknown,
  instance: ComponentInstance,
) {
  return factory.call(null, instance.props)
}

// TODO optimization: maybe convert functions into computeds
function resolveSource(source: PropSource): Record<string, any> {
  return isFunction(source) ? source() : source
}

export function getDynamicPropsHandlers(
  comp: Component,
  instance: ComponentInstance,
): [ProxyHandler<RawProps>, ProxyHandler<RawProps>] {
  if (comp.__propsHandlers) {
    return comp.__propsHandlers
  }
  let normalizedKeys: string[] | undefined
  const propsOptions = normalizePropsOptions(comp)[0]!
  const isProp = (key: string | symbol) => hasOwn(propsOptions, key)

  const getProp = (target: RawProps, key: string | symbol, asProp: boolean) => {
    if (key !== '$' && (asProp ? isProp(key) : !isProp(key))) {
      const castProp = (value: any, isAbsent = false) =>
        asProp
          ? resolvePropValue(
              propsOptions,
              key as string,
              value,
              instance,
              resolveDefault,
              isAbsent,
            )
          : value

      if (key in target) {
        // TODO default value, casting, etc.
        return castProp(resolveSource(target[key as string]))
      }
      if (target.$) {
        let i = target.$.length
        let source
        while (i--) {
          source = resolveSource(target.$[i])
          if (hasOwn(source, key)) {
            return castProp(source[key])
          }
        }
      }
      return castProp(undefined, true)
    }
  }

  const propsHandlers = {
    get: (target, key) => getProp(target, key, true),
    has: (_, key) => isProp(key),
    getOwnPropertyDescriptor(target, key) {
      if (isProp(key)) {
        return {
          configurable: true,
          enumerable: true,
          get: () => getProp(target, key, true),
        }
      }
    },
    ownKeys: () =>
      normalizedKeys || (normalizedKeys = Object.keys(propsOptions)),
    set: NO,
    deleteProperty: NO,
  } satisfies ProxyHandler<RawProps>

  const hasAttr = (target: RawProps, key: string | symbol) => {
    if (key === '$' || isProp(key)) return false
    if (hasOwn(target, key)) return true
    if (target.$) {
      let i = target.$.length
      while (i--) {
        if (hasOwn(resolveSource(target.$[i]), key)) {
          return true
        }
      }
    }
    return false
  }

  const attrsHandlers = {
    get: (target, key) => getProp(target, key, false),
    has: hasAttr,
    getOwnPropertyDescriptor(target, key) {
      if (hasAttr(target, key)) {
        return {
          configurable: true,
          enumerable: true,
          get: () => getProp(target, key, false),
        }
      }
    },
    ownKeys(target) {
      const staticKeys = Object.keys(target).filter(
        key => key !== '$' && !isProp(key),
      )
      if (target.$) {
        let i = target.$.length
        while (i--) {
          staticKeys.push(...Object.keys(resolveSource(target.$[i])))
        }
      }
      return staticKeys
    },
    set: NO,
    deleteProperty: NO,
  } satisfies ProxyHandler<RawProps>

  return (comp.__propsHandlers = [propsHandlers, attrsHandlers])
}

function normalizePropsOptions(comp: Component): NormalizedPropsOptions {
  const cached = comp.__propsOptions
  if (cached) return cached

  const raw = comp.props
  if (!raw) return EMPTY_ARR as []

  const normalized: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []
  baseNormalizePropsOptions(raw, normalized, needCastKeys)

  return (comp.__propsOptions = [normalized, needCastKeys])
}
