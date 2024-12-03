import { EMPTY_ARR, NO, camelize, hasOwn, isFunction } from '@vue/shared'
import type { VaporComponent, VaporComponentInstance } from './component'
import {
  type NormalizedPropsOptions,
  baseNormalizePropsOptions,
  isEmitListener,
  resolvePropValue,
} from '@vue/runtime-core'
import { normalizeEmitsOptions } from './componentEmits'

export interface RawProps {
  [key: string]: PropSource
  $?: DynamicPropsSource[]
}

type PropSource<T = any> = T | (() => T)

type DynamicPropsSource = PropSource<Record<string, any>>

export function initStaticProps(
  comp: VaporComponent,
  rawProps: RawProps | undefined,
  instance: VaporComponentInstance,
): boolean {
  let hasAttrs = false
  const { props, attrs } = instance
  const [propsOptions, needCastKeys] = normalizePropsOptions(comp)
  const emitsOptions = normalizeEmitsOptions(comp)
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
    } else if (!isEmitListener(emitsOptions, key)) {
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
  instance: VaporComponentInstance,
) {
  return factory.call(null, instance.props)
}

// TODO optimization: maybe convert functions into computeds
function resolveSource(source: PropSource): Record<string, any> {
  return isFunction(source) ? source() : source
}

export function getDynamicPropsHandlers(
  comp: VaporComponent,
  instance: VaporComponentInstance,
): [ProxyHandler<RawProps>, ProxyHandler<RawProps>] {
  if (comp.__propsHandlers) {
    return comp.__propsHandlers
  }
  let normalizedKeys: string[] | undefined
  const propsOptions = normalizePropsOptions(comp)[0]!
  const emitsOptions = normalizeEmitsOptions(comp)
  const isProp = (key: string) => hasOwn(propsOptions, key)

  const getProp = (target: RawProps, key: string, asProp: boolean) => {
    if (key === '$') return
    if (asProp) {
      if (!isProp(key)) return
    } else if (isProp(key) || isEmitListener(emitsOptions, key)) {
      return
    }
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

  const propsHandlers = {
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
    ownKeys: () =>
      normalizedKeys || (normalizedKeys = Object.keys(propsOptions)),
    set: NO,
    deleteProperty: NO,
  } satisfies ProxyHandler<RawProps>

  const hasAttr = (target: RawProps, key: string) => {
    if (key === '$' || isProp(key) || isEmitListener(emitsOptions, key))
      return false
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
    get: (target, key: string) => getProp(target, key, false),
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
      const staticKeys = Object.keys(target)
      if (target.$) {
        let i = target.$.length
        while (i--) {
          staticKeys.push(...Object.keys(resolveSource(target.$[i])))
        }
      }
      return staticKeys.filter(key => hasAttr(target, key))
    },
    set: NO,
    deleteProperty: NO,
  } satisfies ProxyHandler<RawProps>

  return (comp.__propsHandlers = [propsHandlers, attrsHandlers])
}

function normalizePropsOptions(comp: VaporComponent): NormalizedPropsOptions {
  const cached = comp.__propsOptions
  if (cached) return cached

  const raw = comp.props
  if (!raw) return EMPTY_ARR as []

  const normalized: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []
  baseNormalizePropsOptions(raw, normalized, needCastKeys)

  return (comp.__propsOptions = [normalized, needCastKeys])
}
