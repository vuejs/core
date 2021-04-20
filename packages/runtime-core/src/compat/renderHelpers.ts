import {
  camelize,
  extend,
  hyphenate,
  isArray,
  isObject,
  isReservedProp,
  normalizeClass
} from '@vue/shared'
import { ComponentInternalInstance } from '../component'
import { renderSlot } from '../helpers/renderSlot'
import { mergeProps, VNode } from '../vnode'

export function legacyBindObjectProps(
  data: any,
  _tag: string,
  value: any,
  _asProp: boolean,
  isSync?: boolean
) {
  if (value && isObject(value)) {
    if (isArray(value)) {
      value = toObject(value)
    }
    for (const key in value) {
      if (isReservedProp(key)) {
        data[key] = value[key]
      } else if (key === 'class') {
        data.class = normalizeClass([data.class, value.class])
      } else if (key === 'style') {
        data.style = normalizeClass([data.style, value.style])
      } else {
        const attrs = data.attrs || (data.attrs = {})
        const camelizedKey = camelize(key)
        const hyphenatedKey = hyphenate(key)
        if (!(camelizedKey in attrs) && !(hyphenatedKey in attrs)) {
          attrs[key] = value[key]

          if (isSync) {
            const on = data.on || (data.on = {})
            on[`update:${key}`] = function($event: any) {
              value[key] = $event
            }
          }
        }
      }
    }
  }
  return data
}

export function legacyRenderSlot(
  instance: ComponentInternalInstance,
  name: string,
  fallback?: VNode[],
  props?: any,
  bindObject?: any
) {
  if (bindObject) {
    props = mergeProps(props, bindObject)
  }
  return renderSlot(instance.slots, name, props, fallback && (() => fallback))
}

const staticCacheMap = /*#__PURE__*/ new WeakMap<
  ComponentInternalInstance,
  any[]
>()

export function legacyRenderStatic(
  instance: ComponentInternalInstance,
  index: number
) {
  let cache = staticCacheMap.get(instance)
  if (!cache) {
    staticCacheMap.set(instance, (cache = []))
  }
  if (cache[index]) {
    return cache[index]
  }
  const fn = (instance.type as any).staticRenderFns[index]
  const ctx = instance.proxy
  return (cache[index] = fn.call(ctx, null, ctx))
}

function toObject(arr: Array<any>): Object {
  const res = {}
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i])
    }
  }
  return res
}
