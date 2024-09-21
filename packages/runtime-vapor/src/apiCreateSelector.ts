import {
  type MaybeRefOrGetter,
  type ShallowRef,
  onScopeDispose,
  shallowRef,
  toValue,
} from '@vue/reactivity'
import { watchEffect } from './apiWatch'

export function createSelector<T, U extends T>(
  source: MaybeRefOrGetter<T>,
  fn: (key: U, value: T) => boolean = (key, value) => key === value,
): (key: U) => boolean {
  let subs = new Map()
  let val: T
  let oldVal: U

  watchEffect(() => {
    val = toValue(source)
    const keys = [...subs.keys()]
    for (let i = 0, len = keys.length; i < len; i++) {
      const key = keys[i]
      if (fn(key, val)) {
        const o = subs.get(key)
        o.value = true
      } else if (oldVal !== undefined && fn(key, oldVal)) {
        const o = subs.get(key)
        o.value = false
      }
    }
    oldVal = val as U
  })

  return key => {
    let l: ShallowRef<boolean | undefined> & { _count?: number }
    if (!(l = subs.get(key))) subs.set(key, (l = shallowRef()))
    l.value
    l._count ? l._count++ : (l._count = 1)
    onScopeDispose(() => (l._count! > 1 ? l._count!-- : subs.delete(key)))
    return l.value !== undefined ? l.value : fn(key, val)
  }
}
