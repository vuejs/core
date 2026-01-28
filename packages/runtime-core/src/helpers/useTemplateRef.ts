import { type ShallowRef, readonly, shallowRef } from '@vue/reactivity'
import { type Data, getCurrentInstance } from '../component'
import { warn } from '../warning'
import { EMPTY_OBJ } from '@vue/shared'

export const knownTemplateRefs: WeakSet<ShallowRef> = new WeakSet()

const templateRefKeySet = Symbol(__DEV__ ? 'v_templateRefKeys' : '')

const getTemplateRefKeySet = (refs: Data): Set<string> | undefined =>
  (refs as any)[templateRefKeySet] as Set<string> | undefined

export const registerTemplateRefKey = (refs: Data, key: string): void => {
  let set = getTemplateRefKeySet(refs)
  if (!set) {
    set = new Set<string>()
    Object.defineProperty(refs, templateRefKeySet, { value: set })
  }
  set.add(key)
}

export const hasTemplateRefKey = (refs: Data, key: string): boolean => {
  const set = getTemplateRefKeySet(refs)
  return !!set && set.has(key)
}

export type TemplateRef<T = unknown> = Readonly<ShallowRef<T | null>>

export function useTemplateRef<T = unknown, Keys extends string = string>(
  key: Keys,
): TemplateRef<T> {
  const i = getCurrentInstance()
  const r = shallowRef(null)
  if (i) {
    const refs = i.refs === EMPTY_OBJ ? (i.refs = {}) : i.refs
    registerTemplateRefKey(refs, key)
    let desc: PropertyDescriptor | undefined
    if (
      __DEV__ &&
      (desc = Object.getOwnPropertyDescriptor(refs, key)) &&
      !desc.configurable
    ) {
      warn(`useTemplateRef('${key}') already exists.`)
    } else {
      Object.defineProperty(refs, key, {
        enumerable: true,
        get: () => r.value,
        set: val => (r.value = val),
      })
    }
  } else if (__DEV__) {
    warn(
      `useTemplateRef() is called when there is no active component ` +
        `instance to be associated with.`,
    )
  }
  const ret = __DEV__ ? readonly(r) : r
  if (__DEV__) {
    knownTemplateRefs.add(ret)
  }
  return ret
}
