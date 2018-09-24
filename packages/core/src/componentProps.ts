import { EMPTY_OBJ } from './utils'
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
  rawOptions: ComponentPropsOptions,
  Component: ComponentClass
): Data {
  const hasDeclaredProps = rawOptions !== void 0
  const options = (hasDeclaredProps &&
    normalizePropsOptions(rawOptions)) as NormalizedPropsOptions
  if (!raw && !hasDeclaredProps) {
    return EMPTY_OBJ
  }
  const res: Data = {}
  if (raw) {
    for (const key in raw) {
      // key, ref, slots are reserved
      if (key === 'key' || key === 'ref' || key === 'slots') {
        continue
      }
      // class, style & nativeOn are always extracted into a separate `attrs`
      // object, which can then be merged onto child component root.
      // in addition, if the component has explicitly declared props, then
      // any non-matching props are extracted into `attrs` as well.
      let isNativeOn
      if (
        key === 'class' ||
        key === 'style' ||
        (isNativeOn = key.startsWith('nativeOn')) ||
        (hasDeclaredProps && !options.hasOwnProperty(key))
      ) {
        const newKey = isNativeOn ? 'on' + key.slice(8) : key
        ;(res.attrs || (res.attrs = {}))[newKey] = raw[key]
      } else {
        if (__DEV__ && hasDeclaredProps && options.hasOwnProperty(key)) {
          validateProp(key, raw[key], options[key], Component)
        }
        res[key] = raw[key]
      }
    }
  }
  // set default values
  if (hasDeclaredProps) {
    for (const key in options) {
      if (res[key] === void 0) {
        const opt = options[key]
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
