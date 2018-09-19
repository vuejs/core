import { EMPTY_OBJ, isReservedProp } from './utils'
import { Component, ComponentClass, MountedComponent } from './component'
import { immutable, unwrap, lock, unlock } from '@vue/observer'
import {
  Data,
  ComponentPropsOptions,
  NormalizedPropsOptions,
  PropValidator,
  PropOptions
} from './componentOptions'

export function initializeProps(instance: Component, props: Data | null) {
  instance.$props = immutable(props || {})
}

export function updateProps(instance: MountedComponent, nextProps: Data) {
  // instance.$props is an observable that should not be replaced.
  // instead, we mutate it to match latest props, which will trigger updates
  // if any value has changed.
  if (nextProps != null) {
    const props = instance.$props
    const rawProps = unwrap(props)
    // unlock to temporarily allow mutatiing props
    unlock()
    for (const key in rawProps) {
      if (!nextProps.hasOwnProperty(key)) {
        delete props[key]
      }
    }
    for (const key in nextProps) {
      props[key] = nextProps[key]
    }
    lock()
  }
}

// This is called for every component vnode created. This also means the data
// on every component vnode is guarunteed to be a fresh object.
export function normalizeComponentProps(
  raw: any,
  options: ComponentPropsOptions,
  Component: ComponentClass
): Data {
  if (!raw) {
    return EMPTY_OBJ
  }
  const res: Data = {}
  const normalizedOptions = options && normalizePropsOptions(options)
  for (const key in raw) {
    if (isReservedProp(key)) {
      continue
    }
    if (__DEV__ && normalizedOptions != null) {
      validateProp(key, raw[key], normalizedOptions[key], Component)
    } else {
      res[key] = raw[key]
    }
  }
  // set default values
  if (normalizedOptions != null) {
    for (const key in normalizedOptions) {
      if (res[key] === void 0) {
        const opt = normalizedOptions[key]
        if (opt != null && opt.hasOwnProperty('default')) {
          const defaultValue = opt.default
          res[key] =
            typeof defaultValue === 'function' ? defaultValue() : defaultValue
        }
      }
    }
  }
  return res
}

const normalizeCache: WeakMap<
  ComponentPropsOptions,
  NormalizedPropsOptions
> = new WeakMap()
function normalizePropsOptions(
  raw: ComponentPropsOptions
): NormalizedPropsOptions {
  let cached = normalizeCache.get(raw)
  if (cached) {
    return cached
  }
  const normalized: NormalizedPropsOptions = {}
  for (const key in raw) {
    const opt = raw[key]
    normalized[key] =
      typeof opt === 'function' ? { type: opt } : (opt as PropOptions)
  }
  normalizeCache.set(raw, normalized)
  return normalized
}

function validateProp(
  key: string,
  value: any,
  validator: PropValidator<any>,
  Component: ComponentClass
) {
  // TODO
}
