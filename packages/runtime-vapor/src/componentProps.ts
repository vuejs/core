import { EMPTY_ARR, NO, camelize, hasOwn, isFunction } from '@vue/shared'
import type { VaporComponent, VaporComponentInstance } from './component'
import {
  type NormalizedPropsOptions,
  baseNormalizePropsOptions,
  isEmitListener,
  resolvePropValue,
} from '@vue/runtime-dom'
import { normalizeEmitsOptions } from './componentEmits'

export type RawProps = Record<string, () => unknown> & {
  $?: DynamicPropsSource[]
}

type DynamicPropsSource =
  | (() => Record<string, unknown>)
  | Record<string, () => unknown>

export function initStaticProps(
  comp: VaporComponent,
  rawProps: RawProps | undefined,
  instance: VaporComponentInstance,
): boolean {
  let hasAttrs = false
  const { props, attrs } = instance
  const [propsOptions, needCastKeys] = normalizePropsOptions(comp)
  const emitsOptions = normalizeEmitsOptions(comp)

  // for dev emit check
  if (__DEV__) {
    instance.propsOptions = normalizePropsOptions(comp)
    instance.emitsOptions = emitsOptions
  }

  for (const key in rawProps) {
    const normalizedKey = camelize(key)
    const needCast = needCastKeys && needCastKeys.includes(normalizedKey)
    const source = rawProps[key]
    if (propsOptions && normalizedKey in propsOptions) {
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
    } else if (!isEmitListener(emitsOptions, key)) {
      Object.defineProperty(attrs, key, {
        enumerable: true,
        get: source,
      })
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
export function resolveSource(
  source: Record<string, any> | (() => Record<string, any>),
): Record<string, any> {
  return isFunction(source) ? source() : source
}

const passThrough = (val: any) => val

export function getDynamicPropsHandlers(
  comp: VaporComponent,
  instance: VaporComponentInstance,
): [ProxyHandler<RawProps> | null, ProxyHandler<RawProps>] {
  if (comp.__propsHandlers) {
    return comp.__propsHandlers
  }
  let normalizedKeys: string[] | undefined
  const propsOptions = normalizePropsOptions(comp)[0]
  const emitsOptions = normalizeEmitsOptions(comp)
  const isProp = propsOptions ? (key: string) => hasOwn(propsOptions, key) : NO

  const getProp = (target: RawProps, key: string, asProp: boolean) => {
    if (key === '$') return
    if (asProp) {
      if (!isProp(key)) return
    } else if (isProp(key) || isEmitListener(emitsOptions, key)) {
      return
    }
    const castProp = propsOptions
      ? (value: any, isAbsent = false) =>
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
      : passThrough

    if (key in target) {
      return castProp(target[key as string]())
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
          return castProp(isDynamic ? source[key] : source[key]())
        }
      }
    }
    return castProp(undefined, true)
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
        ownKeys: () =>
          normalizedKeys || (normalizedKeys = Object.keys(propsOptions)),
        set: NO,
        deleteProperty: NO,
      } satisfies ProxyHandler<RawProps>)
    : null

  const hasAttr = (target: RawProps, key: string) => {
    if (key === '$' || isProp(key) || isEmitListener(emitsOptions, key)) {
      return false
    }
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
      const keys = Object.keys(target)
      const dynamicSources = target.$
      if (dynamicSources) {
        let i = dynamicSources.length
        while (i--) {
          keys.push(...Object.keys(resolveSource(dynamicSources[i])))
        }
      }
      return keys.filter(key => hasAttr(target, key))
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
