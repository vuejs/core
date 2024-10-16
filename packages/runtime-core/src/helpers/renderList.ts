import { type VNode, type VNodeChild, isVNode } from '../vnode'
import {
  isReactive,
  isShallow,
  shallowReadArray,
  toReactive,
} from '@vue/reactivity'
import { isArray, isObject, isString } from '@vue/shared'
import { warn } from '../warning'

/**
 * v-for string
 * @private
 */
export function renderList(
  source: string,
  renderItem: (value: string, index: number) => VNodeChild,
): VNodeChild[]

/**
 * v-for number
 */
export function renderList(
  source: number,
  renderItem: (value: number, index: number) => VNodeChild,
): VNodeChild[]

/**
 * v-for array
 */
export function renderList<T>(
  source: T[],
  renderItem: (value: T, index: number) => VNodeChild,
): VNodeChild[]

/**
 * v-for iterable
 */
export function renderList<T>(
  source: Iterable<T>,
  renderItem: (value: T, index: number) => VNodeChild,
): VNodeChild[]

/**
 * v-for object
 */
export function renderList<T>(
  source: T,
  renderItem: <K extends keyof T>(
    value: T[K],
    key: string,
    index: number,
  ) => VNodeChild,
): VNodeChild[]

/**
 * Actual implementation
 */
export function renderList(
  source: any,
  renderItem: (...args: any[]) => VNodeChild,
  cache?: {
    list: any[]
    map: Record<string | number | symbol, VNode>
  }[],
  index?: number,
): VNodeChild[] {
  let ret: VNodeChild[]
  const retMap: Record<string | number | symbol, VNode> = {}
  const cachedList = (cache && cache[index!] && cache[index!].list) as
    | VNode[]
    | undefined
  const cachedMap = (cache && cache[index!] && cache[index!].map) as
    | Record<string | number | symbol, VNode>
    | undefined
  const sourceIsArray = isArray(source)

  if (sourceIsArray || isString(source)) {
    const sourceIsReactiveArray = sourceIsArray && isReactive(source)
    let needsWrap = false
    if (sourceIsReactiveArray) {
      needsWrap = !isShallow(source)
      source = shallowReadArray(source)
    }
    ret = new Array(source.length)
    for (let i = 0, l = source.length; i < l; i++) {
      const item = renderItem(
        needsWrap ? toReactive(source[i]) : source[i],
        i,
        undefined,
        cachedList && cachedList[i],
        cachedMap,
      )
      if (isVNode(item) && item!.key != null) {
        retMap[item!.key] = item!
      }
      ret[i] = item
    }
  } else if (typeof source === 'number') {
    if (__DEV__ && !Number.isInteger(source)) {
      warn(`The v-for range expect an integer value but got ${source}.`)
    }
    ret = new Array(source)
    for (let i = 0; i < source; i++) {
      const item = renderItem(
        i + 1,
        i,
        undefined,
        cachedList && cachedList[i],
        cachedMap,
      )
      if (isVNode(item) && item.key != null) {
        retMap[item.key] = item
      }
      ret[i] = item
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator as any]) {
      ret = Array.from(source as Iterable<any>, (sourceItem, i) => {
        const item = renderItem(
          sourceItem,
          i,
          undefined,
          cachedList && cachedList[i],
          cachedMap,
        )
        if (isVNode(item) && item.key != null) {
          retMap[item.key] = item
        }
        return item
      })
    } else {
      const keys = Object.keys(source)
      ret = new Array(keys.length)
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i]
        const item = renderItem(
          source[key],
          key,
          i,
          cachedList && cachedList[i],
          cachedMap,
        )
        if (isVNode(item) && item.key != null) {
          retMap[item.key] = item
        }
        ret[i] = item
      }
    }
  } else {
    ret = []
  }

  if (cache) {
    cache[index!] = {
      list: ret,
      map: retMap,
    }
  }
  return ret
}
