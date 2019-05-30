import { immutable, unwrap, lock, unlock } from '@vue/observer'
import {
  EMPTY_OBJ,
  camelize,
  hyphenate,
  capitalize,
  isString,
  isFunction,
  isArray,
  isObject
} from '@vue/shared'
import { warn } from './warning'
import { Data, ComponentInstance } from './component'

export type ComponentPropsOptions<P = Data> = {
  [K in keyof P]: PropValidator<P[K]>
}

export type Prop<T> = { (): T } | { new (...args: any[]): T & object }

export type PropType<T> = Prop<T> | Prop<T>[]

export type PropValidator<T> = PropOptions<T> | PropType<T>

export interface PropOptions<T = any> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: T | null | undefined | (() => T | null | undefined)
  validator?(value: T): boolean
}

const enum BooleanFlags {
  shouldCast = '1',
  shouldCastTrue = '2'
}

type NormalizedProp = PropOptions & {
  [BooleanFlags.shouldCast]?: boolean
  [BooleanFlags.shouldCastTrue]?: boolean
}

type NormalizedPropsOptions = Record<string, NormalizedProp>

const isReservedKey = (key: string): boolean => key[0] === '_' || key[0] === '$'

// resolve raw VNode data.
// - filter out reserved keys (key, ref, slots)
// - extract class and style into $attrs (to be merged onto child
//   component root)
// - for the rest:
//   - if has declared props: put declared ones in `props`, the rest in `attrs`
//   - else: everything goes in `props`.

export function resolveProps(
  instance: ComponentInstance,
  rawProps: any,
  _options: ComponentPropsOptions | void
) {
  const hasDeclaredProps = _options != null
  const options = normalizePropsOptions(_options) as NormalizedPropsOptions
  if (!rawProps && !hasDeclaredProps) {
    return
  }

  const props: any = {}
  let attrs: any = void 0

  // update the instance propsProxy (passed to setup()) to trigger potential
  // changes
  const propsProxy = instance.propsProxy
  const setProp = propsProxy
    ? (key: string, val: any) => {
        props[key] = val
        propsProxy[key] = val
      }
    : (key: string, val: any) => {
        props[key] = val
      }

  // allow mutation of propsProxy (which is immutable by default)
  unlock()

  if (rawProps != null) {
    for (const key in rawProps) {
      // key, ref, slots are reserved
      if (key === 'key' || key === 'ref' || key === 'slots') {
        continue
      }
      // any non-declared data are put into a separate `attrs` object
      // for spreading
      if (hasDeclaredProps && !options.hasOwnProperty(key)) {
        ;(attrs || (attrs = {}))[key] = rawProps[key]
      } else {
        setProp(key, rawProps[key])
      }
    }
  }
  // set default values, cast booleans & run validators
  if (hasDeclaredProps) {
    for (const key in options) {
      let opt = options[key]
      if (opt == null) continue
      const isAbsent = !props.hasOwnProperty(key)
      const hasDefault = opt.hasOwnProperty('default')
      const currentValue = props[key]
      // default values
      if (hasDefault && currentValue === undefined) {
        const defaultValue = opt.default
        setProp(key, isFunction(defaultValue) ? defaultValue() : defaultValue)
      }
      // boolean casting
      if (opt[BooleanFlags.shouldCast]) {
        if (isAbsent && !hasDefault) {
          setProp(key, false)
        } else if (
          opt[BooleanFlags.shouldCastTrue] &&
          (currentValue === '' || currentValue === hyphenate(key))
        ) {
          setProp(key, true)
        }
      }
      // runtime validation
      if (__DEV__ && rawProps) {
        validateProp(key, unwrap(rawProps[key]), opt, isAbsent)
      }
    }
  } else {
    // if component has no declared props, $attrs === $props
    attrs = props
  }

  // lock immutable
  lock()

  instance.props = __DEV__ ? immutable(props) : props
  instance.attrs = options
    ? __DEV__
      ? immutable(attrs)
      : attrs
    : instance.props
}

const normalizationMap = new WeakMap()

function normalizePropsOptions(
  raw: ComponentPropsOptions | void
): NormalizedPropsOptions | void {
  if (!raw) {
    return
  }
  if (normalizationMap.has(raw)) {
    return normalizationMap.get(raw)
  }
  const normalized: NormalizedPropsOptions = {}
  normalizationMap.set(raw, normalized)
  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (__DEV__ && !isString(raw[i])) {
        warn(`props must be strings when using array syntax.`, raw[i])
      }
      const normalizedKey = camelize(raw[i])
      if (!isReservedKey(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ
      } else if (__DEV__) {
        warn(`Invalid prop name: "${normalizedKey}" is a reserved property.`)
      }
    }
  } else {
    if (__DEV__ && !isObject(raw)) {
      warn(`invalid props options`, raw)
    }
    for (const key in raw) {
      const normalizedKey = camelize(key)
      if (!isReservedKey(normalizedKey)) {
        const opt = raw[key]
        const prop = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : opt)
        if (prop) {
          const booleanIndex = getTypeIndex(Boolean, prop.type)
          const stringIndex = getTypeIndex(String, prop.type)
          ;(prop as NormalizedProp)[BooleanFlags.shouldCast] = booleanIndex > -1
          ;(prop as NormalizedProp)[BooleanFlags.shouldCastTrue] =
            booleanIndex < stringIndex
        }
      } else if (__DEV__) {
        warn(`Invalid prop name: "${normalizedKey}" is a reserved property.`)
      }
    }
  }
  return normalized
}

// use function string name to check type constructors
// so that it works across vms / iframes.
function getType(ctor: Prop<any>): string {
  const match = ctor && ctor.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

function isSameType(a: Prop<any>, b: Prop<any>): boolean {
  return getType(a) === getType(b)
}

function getTypeIndex(
  type: Prop<any>,
  expectedTypes: PropType<any> | void | null | true
): number {
  if (isArray(expectedTypes)) {
    for (let i = 0, len = expectedTypes.length; i < len; i++) {
      if (isSameType(expectedTypes[i], type)) {
        return i
      }
    }
  } else if (isObject(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  return -1
}

type AssertionResult = {
  valid: boolean
  expectedType: string
}

function validateProp(
  name: string,
  value: any,
  prop: PropOptions<any>,
  isAbsent: boolean
) {
  const { type, required, validator } = prop
  // required!
  if (required && isAbsent) {
    warn('Missing required prop: "' + name + '"')
    return
  }
  // missing but optional
  if (value == null && !prop.required) {
    return
  }
  // type check
  if (type != null && type !== true) {
    let isValid = false
    const types = isArray(type) ? type : [type]
    const expectedTypes = []
    // value is valid as long as one of the specified types match
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType(value, types[i])
      expectedTypes.push(expectedType || '')
      isValid = valid
    }
    if (!isValid) {
      warn(getInvalidTypeMessage(name, value, expectedTypes))
      return
    }
  }
  // custom validator
  if (validator && !validator(value)) {
    warn('Invalid prop: custom validator check failed for prop "' + name + '".')
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType(value: any, type: Prop<any>): AssertionResult {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = toRawType(value) === 'Object'
  } else if (expectedType === 'Array') {
    valid = isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

function getInvalidTypeMessage(
  name: string,
  value: any,
  expectedTypes: string[]
): string {
  let message =
    `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)
  // check if we need to specify expected value
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}

function styleValue(value: any, type: string): string {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

function toRawType(value: any): string {
  return Object.prototype.toString.call(value).slice(8, -1)
}

function isExplicable(type: string): boolean {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => type.toLowerCase() === elem)
}

function isBoolean(...args: string[]): boolean {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
