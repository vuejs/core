import { camelize, isArray, isFunction } from '@vue/shared'
import { type ComponentInternalInstance, currentInstance } from './component'
import { isEmitListener } from './componentEmits'
import { setDynamicProps } from './dom/prop'
import type { RawProps } from './componentProps'
import { renderEffect } from './renderEffect'

export function patchAttrs(instance: ComponentInternalInstance): void {
  const {
    attrs,
    rawProps,
    propsOptions: [options],
  } = instance

  if (!rawProps.length) return
  const keys = new Set<string>()
  for (const props of Array.from(rawProps).reverse()) {
    if (isFunction(props)) {
      const resolved = props()
      for (const rawKey in resolved) {
        registerAttr(rawKey, resolved[rawKey])
      }
    } else {
      for (const rawKey in props) {
        registerAttr(rawKey, props[rawKey], true)
      }
    }
  }

  for (const key in attrs) {
    if (!keys.has(key)) {
      delete attrs[key]
    }
  }

  function registerAttr(key: string, value: any, getter?: boolean) {
    if (
      (!options || !(camelize(key) in options)) &&
      !isEmitListener(instance.emitsOptions, key) &&
      !keys.has(key)
    ) {
      keys.add(key)
      if (getter) {
        Object.defineProperty(attrs, key, {
          get: value,
          enumerable: true,
          configurable: true,
        })
      } else {
        attrs[key] = value
      }
    }
  }
}

export function withAttrs(props: RawProps): RawProps {
  const instance = currentInstance!
  if (instance.type.inheritAttrs === false) return props
  const attrsGetter = () => instance.attrs
  if (!props) return [attrsGetter]
  if (isArray(props)) {
    return [attrsGetter, ...props]
  }
  return [attrsGetter, props]
}

export function fallThroughAttrs(instance: ComponentInternalInstance): void {
  const {
    block,
    type: { inheritAttrs },
  } = instance
  if (inheritAttrs === false) return

  if (block instanceof Element) {
    renderEffect(() => setDynamicProps(block, instance.attrs))
  }
}
