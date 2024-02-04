// NOTE: runtime-core/src/componentProps.ts

import {
  type Data,
  EMPTY_ARR,
  EMPTY_OBJ,
  camelize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
  isReservedProp,
} from '@vue/shared'
import { shallowReactive, shallowReadonly, toRaw } from '@vue/reactivity'
import { warn } from './warning'
import {
  type Component,
  type ComponentInternalInstance,
  setCurrentInstance,
} from './component'

export type ComponentPropsOptions<P = Data> =
  | ComponentObjectPropsOptions<P>
  | string[]

export type ComponentObjectPropsOptions<P = Data> = {
  [K in keyof P]: Prop<P[K]> | null
}

export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>

type DefaultFactory<T> = (props: Data) => T | null | undefined

export interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: D | DefaultFactory<D> | null | undefined | object
  validator?(value: unknown, props: Data): boolean
  /**
   * @internal
   */
  skipFactory?: boolean
}

export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

type PropConstructor<T = any> =
  | { new (...args: any[]): T & {} }
  | { (): T }
  | PropMethod<T>

type PropMethod<T, TConstructor = any> = [T] extends [
  ((...args: any) => any) | undefined,
] // if is function with args, allowing non-required functions
  ? { new (): TConstructor; (): T; readonly prototype: TConstructor } // Create Function like constructor
  : never

enum BooleanFlags {
  shouldCast,
  shouldCastTrue,
}

type NormalizedProp =
  | null
  | (PropOptions & {
      [BooleanFlags.shouldCast]?: boolean
      [BooleanFlags.shouldCastTrue]?: boolean
    })

export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions = [NormalizedProps, string[]] | []

export function initProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
) {
  const props: Data = {}

  const [options, needCastKeys] = instance.propsOptions
  let rawCastValues: Data | undefined
  if (rawProps) {
    for (let key in rawProps) {
      // key, ref are reserved and never passed down
      if (isReservedProp(key)) {
        continue
      }

      const valueGetter = () => rawProps[key]
      let camelKey
      if (options && hasOwn(options, (camelKey = camelize(key)))) {
        if (!needCastKeys || !needCastKeys.includes(camelKey)) {
          // NOTE: must getter
          // props[camelKey] = value
          Object.defineProperty(props, camelKey, {
            get() {
              return valueGetter()
            },
          })
        } else {
          // NOTE: must getter
          // ;(rawCastValues || (rawCastValues = {}))[camelKey] = value
          rawCastValues || (rawCastValues = {})
          Object.defineProperty(rawCastValues, camelKey, {
            get() {
              return valueGetter()
            },
          })
        }
      } else {
        // TODO:
      }
    }
  }

  if (needCastKeys) {
    const rawCurrentProps = toRaw(props)
    const castValues = rawCastValues || EMPTY_OBJ
    for (let i = 0; i < needCastKeys.length; i++) {
      const key = needCastKeys[i]

      // NOTE: must getter
      // props[key] = resolvePropValue(
      //   options!,
      //   rawCurrentProps,
      //   key,
      //   castValues[key],
      //   instance,
      //   !hasOwn(castValues, key),
      // )
      Object.defineProperty(props, key, {
        get() {
          return resolvePropValue(
            options!,
            rawCurrentProps,
            key,
            castValues[key],
            instance,
            !hasOwn(castValues, key),
          )
        },
      })
    }
  }

  // validation
  if (__DEV__) {
    validateProps(rawProps || {}, props, instance)
  }

  instance.props = shallowReactive(props)
}

function resolvePropValue(
  options: NormalizedProps,
  props: Data,
  key: string,
  value: unknown,
  instance: ComponentInternalInstance,
  isAbsent: boolean,
) {
  const opt = options[key]
  if (opt != null) {
    const hasDefault = hasOwn(opt, 'default')
    // default values
    if (hasDefault && value === undefined) {
      const defaultValue = opt.default
      if (
        opt.type !== Function &&
        !opt.skipFactory &&
        isFunction(defaultValue)
      ) {
        // TODO: caching?
        // const { propsDefaults } = instance
        // if (key in propsDefaults) {
        //   value = propsDefaults[key]
        // } else {
        const reset = setCurrentInstance(instance)
        value = defaultValue.call(null, props)
        reset()
        // }
      } else {
        value = defaultValue
      }
    }
    // boolean casting
    if (opt[BooleanFlags.shouldCast]) {
      if (isAbsent && !hasDefault) {
        value = false
      } else if (
        opt[BooleanFlags.shouldCastTrue] &&
        (value === '' || value === hyphenate(key))
      ) {
        value = true
      }
    }
  }
  return value
}

export function normalizePropsOptions(comp: Component): NormalizedPropsOptions {
  // TODO: cahching?

  const raw = comp.props as any
  const normalized: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []

  if (!raw) {
    return EMPTY_ARR as any
  }

  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const normalizedKey = camelize(raw[i])
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ
      }
    }
  } else if (raw) {
    for (const key in raw) {
      const normalizedKey = camelize(key)
      if (validatePropName(normalizedKey)) {
        const opt = raw[key]
        const prop: NormalizedProp = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt))
        if (prop) {
          const booleanIndex = getTypeIndex(Boolean, prop.type)
          const stringIndex = getTypeIndex(String, prop.type)
          prop[BooleanFlags.shouldCast] = booleanIndex > -1
          prop[BooleanFlags.shouldCastTrue] =
            stringIndex < 0 || booleanIndex < stringIndex
          // if the prop needs boolean casting or default value
          if (booleanIndex > -1 || hasOwn(prop, 'default')) {
            needCastKeys.push(normalizedKey)
          }
        }
      }
    }
  }

  const res: NormalizedPropsOptions = [normalized, needCastKeys]
  return res
}

function validatePropName(key: string) {
  if (key[0] !== '$') {
    return true
  }
  return false
}

function getType(ctor: Prop<any>): string {
  const match = ctor && ctor.toString().match(/^\s*(function|class) (\w+)/)
  return match ? match[2] : ctor === null ? 'null' : ''
}

function isSameType(a: Prop<any>, b: Prop<any>): boolean {
  return getType(a) === getType(b)
}

function getTypeIndex(
  type: Prop<any>,
  expectedTypes: PropType<any> | void | null | true,
): number {
  if (isArray(expectedTypes)) {
    return expectedTypes.findIndex(t => isSameType(t, type))
  } else if (isFunction(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  return -1
}

/**
 * dev only
 */
function validateProps(
  rawProps: Data,
  props: Data,
  instance: ComponentInternalInstance,
) {
  const resolvedValues = toRaw(props)
  const options = instance.propsOptions[0]
  for (const key in options) {
    let opt = options[key]
    if (opt == null) continue
    validateProp(
      key,
      resolvedValues[key],
      opt,
      __DEV__ ? shallowReadonly(resolvedValues) : resolvedValues,
      !hasOwn(rawProps, key) && !hasOwn(rawProps, hyphenate(key)),
    )
  }
}

/**
 * dev only
 */
function validateProp(
  name: string,
  value: unknown,
  prop: PropOptions,
  props: Data,
  isAbsent: boolean,
) {
  const { required, validator } = prop
  // required!
  if (required && isAbsent) {
    warn('Missing required prop: "' + name + '"')
    return
  }
  // missing but optional
  if (value == null && !required) {
    return
  }
  // NOTE: type check is not supported in vapor
  // // type check
  // if (type != null && type !== true) {
  //   let isValid = false
  //   const types = isArray(type) ? type : [type]
  //   const expectedTypes = []
  //   // value is valid as long as one of the specified types match
  //   for (let i = 0; i < types.length && !isValid; i++) {
  //     const { valid, expectedType } = assertType(value, types[i])
  //     expectedTypes.push(expectedType || '')
  //     isValid = valid
  //   }
  //   if (!isValid) {
  //     warn(getInvalidTypeMessage(name, value, expectedTypes))
  //     return
  //   }
  // }

  // custom validator
  if (validator && !validator(value, props)) {
    warn('Invalid prop: custom validator check failed for prop "' + name + '".')
  }
}
