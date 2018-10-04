import { immutable, unwrap, lock, unlock } from '@vue/observer'
import { MountedComponent } from './component'
import {
  Data,
  ComponentPropsOptions,
  PropOptions,
  Prop,
  PropType
} from './componentOptions'
import {
  EMPTY_OBJ,
  nativeOnRE,
  vnodeHookRE,
  camelize,
  hyphenate,
  capitalize
} from './utils'

export function initializeProps(instance: MountedComponent, data: Data | null) {
  const { props, attrs } = resolveProps(data, instance.$options.props)
  instance.$props = immutable(props || {})
  instance.$attrs = immutable(attrs || {})
}

export function updateProps(instance: MountedComponent, nextData: Data) {
  // instance.$props and instance.$attrs are observables that should not be
  // replaced. Instead, we mutate them to match latest props, which will trigger
  // updates if any value that's been used in child component has changed.
  if (nextData != null) {
    const { props: nextProps, attrs: nextAttrs } = resolveProps(
      nextData,
      instance.$options.props
    )
    // unlock to temporarily allow mutatiing props
    unlock()
    const props = instance.$props
    const rawProps = unwrap(props)
    for (const key in rawProps) {
      if (!nextProps.hasOwnProperty(key)) {
        delete (props as any)[key]
      }
    }
    for (const key in nextProps) {
      ;(props as any)[key] = nextProps[key]
    }
    if (nextAttrs) {
      const attrs = instance.$attrs
      const rawAttrs = unwrap(attrs)
      for (const key in rawAttrs) {
        if (!nextAttrs.hasOwnProperty(key)) {
          delete attrs[key]
        }
      }
      for (const key in nextAttrs) {
        attrs[key] = nextAttrs[key]
      }
    }
    lock()
  }
}

const EMPTY_PROPS = { props: EMPTY_OBJ }

// resolve raw VNode data.
// - filter out reserved keys (key, ref, slots)
// - extract class, style and nativeOn* into $attrs (to be merged onto child
//   component root)
// - for the rest:
//   - if has declared props: put declared ones in `props`, the rest in `attrs`
//   - else: everything goes in `props`.
export function resolveProps(
  rawData: any,
  rawOptions: ComponentPropsOptions | void
): { props: Data; attrs?: Data } {
  const hasDeclaredProps = rawOptions !== void 0
  if (!rawData && !hasDeclaredProps) {
    return EMPTY_PROPS
  }
  const options = normalizePropsOptions(rawOptions) as NormalizedPropsOptions
  const props: any = {}
  let attrs: any = void 0
  if (rawData != null) {
    for (const key in rawData) {
      // key, ref, slots are reserved
      if (key === 'key' || key === 'ref' || key === 'slots') {
        continue
      }
      // class, style, nativeOn & directive hooks are always extracted into a
      // separate `attrs` object, which can then be merged onto child component
      // root. in addition, if the component has explicitly declared props, then
      // any non-matching props are extracted into `attrs` as well.
      if (
        key === 'class' ||
        key === 'style' ||
        vnodeHookRE.test(key) ||
        nativeOnRE.test(key) ||
        (hasDeclaredProps && !options.hasOwnProperty(key))
      ) {
        ;(attrs || (attrs = {}))[key] = rawData[key]
      } else {
        props[key] = rawData[key]
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
      if (hasDefault && currentValue === void 0) {
        const defaultValue = opt.default
        props[key] =
          typeof defaultValue === 'function' ? defaultValue() : defaultValue
      }
      // boolean casting
      if (opt[BooleanFlags.shouldCast]) {
        if (isAbsent && !hasDefault) {
          props[key] = false
        } else if (
          opt[BooleanFlags.shouldCastTrue] &&
          (currentValue === '' || currentValue === hyphenate(key))
        ) {
          props[key] = true
        }
      }
      // runtime validation
      if (__DEV__) {
        validateProp(key, unwrap(rawData[key]), opt, isAbsent)
      }
    }
  }
  return { props, attrs }
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

const normalizationCache = new WeakMap<
  ComponentPropsOptions,
  NormalizedPropsOptions
>()

function normalizePropsOptions(
  raw: ComponentPropsOptions | void
): NormalizedPropsOptions {
  if (!raw) {
    return EMPTY_OBJ
  }
  const hit = normalizationCache.get(raw)
  if (hit) {
    return hit
  }
  const normalized: NormalizedPropsOptions = {}
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (__DEV__ && typeof raw !== 'string') {
        console.warn(`props must be strings when using array syntax.`)
      }
      normalized[camelize(raw[i])] = EMPTY_OBJ
    }
  } else {
    if (__DEV__ && typeof raw !== 'object') {
      console.warn(`invalid props options: `, raw)
    }
    for (const key in raw) {
      const opt = raw[key]
      const prop = (normalized[camelize(key)] =
        Array.isArray(opt) || typeof opt === 'function'
          ? { type: opt }
          : opt) as NormalizedProp
      const booleanIndex = getTypeIndex(Boolean, prop.type)
      const stringIndex = getTypeIndex(String, prop.type)
      prop[BooleanFlags.shouldCast] = booleanIndex > -1
      prop[BooleanFlags.shouldCastTrue] = booleanIndex < stringIndex
    }
  }
  normalizationCache.set(raw, normalized)
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
  if (Array.isArray(expectedTypes)) {
    for (let i = 0, len = expectedTypes.length; i < len; i++) {
      if (isSameType(expectedTypes[i], type)) {
        return i
      }
    }
  } else if (expectedTypes != null && typeof expectedTypes === 'object') {
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
    console.warn('Missing required prop: "' + name + '"')
    return
  }
  // missing but optional
  if (value == null && !prop.required) {
    return
  }
  // type check
  if (type != null && type !== true) {
    let isValid = false
    const types = Array.isArray(type) ? type : [type]
    const expectedTypes = []
    // value is valid as long as one of the specified types match
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType(value, types[i])
      expectedTypes.push(expectedType || '')
      isValid = valid
    }
    if (!isValid) {
      console.warn(getInvalidTypeMessage(name, value, expectedTypes))
      return
    }
  }
  // custom validator
  if (validator && !validator(value)) {
    console.warn(
      'Invalid prop: custom validator check failed for prop "' + name + '".'
    )
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
    valid = Array.isArray(value)
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
