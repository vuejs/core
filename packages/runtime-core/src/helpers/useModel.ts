import { type Ref, customRef, ref } from '@vue/reactivity'
import {
  EMPTY_OBJ,
  camelize,
  hasChanged,
  hyphenate,
  isString,
  looseToNumber,
} from '@vue/shared'
import type { DefineModelOptions, ModelRef } from '../apiSetupHelpers'
import { getCurrentInstance } from '../component'
import { warn } from '../warning'
import type { NormalizedProps } from '../componentProps'
import { watchSyncEffect } from '../apiWatch'

export function useModel<
  M extends string | number | symbol,
  T extends Record<string, any>,
  K extends keyof T,
>(props: T, name: K, options?: DefineModelOptions<T[K]>): ModelRef<T[K], M>
export function useModel(
  props: Record<string, any>,
  name: string,
  options: DefineModelOptions = EMPTY_OBJ,
): Ref {
  const i = getCurrentInstance()!
  if (__DEV__ && !i) {
    warn(`useModel() called without active instance.`)
    return ref() as any
  }

  if (__DEV__ && !(i.propsOptions[0] as NormalizedProps)[name]) {
    warn(`useModel() called with prop "${name}" which is not declared.`)
    return ref() as any
  }

  const camelizedName = camelize(name)
  const hyphenatedName = hyphenate(name)

  const modifierKey =
    name === 'modelValue' ? 'modelModifiers' : `${name}Modifiers`

  const res = customRef((track, trigger) => {
    let localValue: any
    watchSyncEffect(() => {
      const propValue = props[name]
      if (hasChanged(localValue, propValue)) {
        localValue = propValue
        trigger()
      }
    })
    return {
      get() {
        track()
        return options.get ? options.get(localValue) : localValue
      },
      set(value) {
        const rawProps = i.vnode!.props
        let newValue = options.set ? options.set(value) : value
        if (
          !(
            rawProps &&
            // check if parent has passed v-model
            (name in rawProps ||
              camelizedName in rawProps ||
              hyphenatedName in rawProps) &&
            (`onUpdate:${name}` in rawProps ||
              `onUpdate:${camelizedName}` in rawProps ||
              `onUpdate:${hyphenatedName}` in rawProps)
          ) &&
          hasChanged(value, localValue)
        ) {
          localValue = value
          trigger()
        } else {
          if (rawProps) {
            const { trim, number } = rawProps[modifierKey] ?? EMPTY_OBJ
            let modifierValue = newValue
            if (trim) {
              modifierValue = isString(newValue) ? newValue.trim() : newValue
            }
            if (number) {
              modifierValue = looseToNumber(newValue)
            }
            const rawValue =
              rawProps[name] ??
              rawProps[camelizedName] ??
              rawProps[hyphenatedName]
            if (
              hasChanged(value, localValue) &&
              !hasChanged(modifierValue, rawValue)
            ) {
              localValue = modifierValue
              trigger()
            }
          }
        }
        i.emit(`update:${name}`, newValue)
      },
    }
  })

  // @ts-expect-error
  res[Symbol.iterator] = () => {
    let i = 0
    return {
      next() {
        if (i < 2) {
          return { value: i++ ? props[modifierKey] || {} : res, done: false }
        } else {
          return { done: true }
        }
      },
    }
  }

  return res
}
