import { type ShallowRef, readonly, shallowRef } from '@vue/reactivity'
import { getCurrentInstance } from '../component'
import { warn } from '../warning'
import { EMPTY_OBJ } from '@vue/shared'

export const TEMPLATE_REF_KEYS = '__v_ref_keys'

export function useTemplateRef<T = unknown, Keys extends string = string>(
  key: Keys,
): Readonly<ShallowRef<T | null>> {
  const i = getCurrentInstance()
  const r = shallowRef(null)
  if (i) {
    const refs = i.refs === EMPTY_OBJ ? (i.refs = {}) : i.refs

    let desc: PropertyDescriptor | undefined
    if (
      __DEV__ &&
      (desc = Object.getOwnPropertyDescriptor(refs, key)) &&
      !desc.configurable
    ) {
      warn(`useTemplateRef('${key}') already exists.`)
    } else {
      if (refs[TEMPLATE_REF_KEYS]) {
        ;(refs[TEMPLATE_REF_KEYS] as any).add(key)
      } else {
        const set = new Set([key])
        Object.defineProperty(refs, TEMPLATE_REF_KEYS, {
          get: () => set,
        })
      }

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
  return (__DEV__ ? readonly(r) : r) as any
}
