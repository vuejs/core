import { camelize, isFunction } from '@vue/shared'
import type { ComponentInternalInstance } from './component'
import { isEmitListener } from './componentEmits'

export function patchAttrs(instance: ComponentInternalInstance) {
  const attrs = instance.attrs
  const options = instance.propsOptions[0]

  const keys = new Set<string>()
  if (instance.rawProps.length)
    for (const props of Array.from(instance.rawProps).reverse()) {
      if (isFunction(props)) {
        const resolved = props()
        for (const rawKey in resolved) {
          registerAttr(rawKey, () => resolved[rawKey])
        }
      } else {
        for (const rawKey in props) {
          registerAttr(rawKey, props[rawKey])
        }
      }
    }

  for (const key in attrs) {
    if (!keys.has(key)) {
      delete attrs[key]
    }
  }

  function registerAttr(key: string, getter: () => unknown) {
    if (
      (!options || !(camelize(key) in options)) &&
      !isEmitListener(instance.emitsOptions, key)
    ) {
      keys.add(key)
      if (key in attrs) return
      Object.defineProperty(attrs, key, {
        get: getter,
        enumerable: true,
        configurable: true,
      })
    }
  }
}
