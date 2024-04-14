import { camelize, isArray, isFunction } from '@vue/shared'
import { type ComponentInternalInstance, currentInstance } from './component'
import { isEmitListener } from './componentEmits'
import { setDynamicProps } from './dom/prop'
import type { RawProps } from './componentProps'
import { renderEffect } from './renderEffect'

export function patchAttrs(instance: ComponentInternalInstance) {
  const {
    attrs,
    rawProps,
    propsOptions: [options],
  } = instance

  const keys = new Set<string>()
  if (rawProps.length)
    for (const props of Array.from(rawProps).reverse()) {
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

export function withAttrs(props: RawProps): RawProps {
  const instance = currentInstance!
  if (instance.component.inheritAttrs === false) return props
  const attrsGetter = () => instance.attrs
  if (!props) return [attrsGetter]
  if (isArray(props)) {
    return [attrsGetter, ...props]
  }
  return [attrsGetter, props]
}

export function fallThroughAttrs(instance: ComponentInternalInstance) {
  const {
    block,
    component: { inheritAttrs },
  } = instance
  if (inheritAttrs === false) return

  if (block instanceof Element) {
    renderEffect(() => setDynamicProps(block, instance.attrs))
  }
}
