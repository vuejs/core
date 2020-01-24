import { toRaw, lock, unlock } from '@vue/reactivity'
import {
  EMPTY_OBJ,
  camelize,
  hyphenate,
  capitalize,
  isString,
  isFunction,
  isArray,
  isObject,
  hasOwn,
  toRawType,
  PatchFlags,
  makeMap
} from '@vue/shared'
import { warn } from './warning'
import { Data, ComponentInternalInstance } from './component'

export type ComponentPropsOptions<P = Data> =
  | ComponentObjectPropsOptions<P>
  | string[]

export type ComponentObjectPropsOptions<P = Data> = {
  [K in keyof P]: Prop<P[K]> | null
}

export type Prop<T> = PropOptions<T> | PropType<T>

type DefaultFactory<T> = () => T | null | undefined

interface PropOptions<T = any> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: T | DefaultFactory<T> | null | undefined
  validator?(value: unknown): boolean
}

export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

type PropConstructor<T = any> = { new (...args: any[]): T & object } | { (): T }

type RequiredKeys<T, MakeDefaultRequired> = {
  [K in keyof T]: T[K] extends
    | { required: true }
    | (MakeDefaultRequired extends true ? { default: any } : never)
    ? K
    : never
}[keyof T]

type OptionalKeys<T, MakeDefaultRequired> = Exclude<
  keyof T,
  RequiredKeys<T, MakeDefaultRequired>
>

type InferPropType<T> = T extends null
  ? any // null & true would fail to infer
  : T extends { type: null | true }
    ? any // somehow `ObjectConstructor` when inferred from { (): T } becomes `any`
    : T extends ObjectConstructor | { type: ObjectConstructor }
      ? { [key: string]: any }
      : T extends Prop<infer V> ? V : T

export type ExtractPropTypes<
  O,
  MakeDefaultRequired extends boolean = true
> = O extends object
  ? { [K in RequiredKeys<O, MakeDefaultRequired>]: InferPropType<O[K]> } &
      { [K in OptionalKeys<O, MakeDefaultRequired>]?: InferPropType<O[K]> }
  : { [K in string]: any }

const enum BooleanFlags {
  shouldCast,
  shouldCastTrue
}

type NormalizedProp =
  | null
  | (PropOptions & {
      [BooleanFlags.shouldCast]?: boolean
      [BooleanFlags.shouldCastTrue]?: boolean
    })

// normalized value is a tuple of the actual normalized options
// and an array of prop keys that need value casting (booleans and defaults)
type NormalizedPropsOptions = [Record<string, NormalizedProp>, string[]]

// resolve raw VNode data.
// - filter out reserved keys (key, ref)
// - extract class and style into $attrs (to be merged onto child
//   component root)
// - for the rest:
//   - if has declared props: put declared ones in `props`, the rest in `attrs`
//   - else: everything goes in `props`.

export function resolveProps(
  instance: ComponentInternalInstance,
  rawProps: Data | null,
  _options: ComponentPropsOptions | void
) {
  const hasDeclaredProps = _options != null
  if (!rawProps && !hasDeclaredProps) {
    return
  }

  const { 0: options, 1: needCastKeys } = normalizePropsOptions(_options)!
  const props: Data = {}
  let attrs: Data | undefined = void 0

  // update the instance propsProxy (passed to setup()) to trigger potential
  // changes
  const propsProxy = instance.propsProxy
  const setProp = propsProxy
    ? (key: string, val: unknown) => {
        props[key] = val
        propsProxy[key] = val
      }
    : (key: string, val: unknown) => {
        props[key] = val
      }

  // allow mutation of propsProxy (which is readonly by default)
  unlock()

  if (rawProps != null) {
    for (const key in rawProps) {
      // key, ref are reserved and never passed down
      if (key === 'key' || key === 'ref') continue
      // prop option names are camelized during normalization, so to support
      // kebab -> camel conversion here we need to camelize the key.
      if (hasDeclaredProps) {
        const camelKey = camelize(key)
        if (hasOwn(options, camelKey)) {
          setProp(camelKey, rawProps[key])
        } else {
          // Any non-declared props are put into a separate `attrs` object
          // for spreading. Make sure to preserve original key casing
          ;(attrs || (attrs = {}))[key] = rawProps[key]
        }
      } else {
        setProp(key, rawProps[key])
      }
    }
  }
  if (hasDeclaredProps) {
    // set default values & cast booleans
    for (let i = 0; i < needCastKeys.length; i++) {
      const key = needCastKeys[i]
      let opt = options[key]
      if (opt == null) continue
      const isAbsent = !hasOwn(props, key)
      const hasDefault = hasOwn(opt, 'default')
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
    }
    // validation
    if (__DEV__ && rawProps) {
      for (const key in options) {
        let opt = options[key]
        if (opt == null) continue
        let rawValue
        if (!(key in rawProps) && hyphenate(key) in rawProps) {
          rawValue = rawProps[hyphenate(key)]
        } else {
          rawValue = rawProps[key]
        }
        validateProp(key, toRaw(rawValue), opt, !hasOwn(props, key))
      }
    }
  } else {
    // if component has no declared props, $attrs === $props
    attrs = props
  }

  // in case of dynamic props, check if we need to delete keys from
  // the props proxy
  const { patchFlag } = instance.vnode
  if (
    propsProxy !== null &&
    (patchFlag === 0 || patchFlag & PatchFlags.FULL_PROPS)
  ) {
    const rawInitialProps = toRaw(propsProxy)
    for (const key in rawInitialProps) {
      if (!hasOwn(props, key)) {
        delete propsProxy[key]
      }
    }
  }

  // lock readonly
  lock()

  instance.props = props
  instance.attrs = options ? attrs || EMPTY_OBJ : props
}

const normalizationMap = new WeakMap<
  ComponentPropsOptions,
  NormalizedPropsOptions
>()

function normalizePropsOptions(
  raw: ComponentPropsOptions | void
): NormalizedPropsOptions {
  if (!raw) {
    return [] as any
  }
  if (normalizationMap.has(raw)) {
    return normalizationMap.get(raw)!
  }
  const options: NormalizedPropsOptions[0] = {}
  const needCastKeys: NormalizedPropsOptions[1] = []
  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (__DEV__ && !isString(raw[i])) {
        warn(`props must be strings when using array syntax.`, raw[i])
      }
      const normalizedKey = camelize(raw[i])
      if (normalizedKey[0] !== '$') {
        options[normalizedKey] = EMPTY_OBJ
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
      if (normalizedKey[0] !== '$') {
        const opt = raw[key]
        const prop: NormalizedProp = (options[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : opt)
        if (prop != null) {
          const booleanIndex = getTypeIndex(Boolean, prop.type)
          const stringIndex = getTypeIndex(String, prop.type)
          prop[BooleanFlags.shouldCast] = booleanIndex > -1
          prop[BooleanFlags.shouldCastTrue] = booleanIndex < stringIndex
          // if the prop needs boolean casting or default value
          if (booleanIndex > -1 || hasOwn(prop, 'default')) {
            needCastKeys.push(normalizedKey)
          }
        }
      } else if (__DEV__) {
        warn(`Invalid prop name: "${normalizedKey}" is a reserved property.`)
      }
    }
  }
  const normalized: NormalizedPropsOptions = [options, needCastKeys]
  normalizationMap.set(raw, normalized)
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
  value: unknown,
  prop: PropOptions,
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

const isSimpleType = /*#__PURE__*/ makeMap(
  'String,Number,Boolean,Function,Symbol'
)

function assertType(value: unknown, type: PropConstructor): AssertionResult {
  let valid
  const expectedType = getType(type)
  if (isSimpleType(expectedType)) {
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
  value: unknown,
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

function styleValue(value: unknown, type: string): string {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

function isExplicable(type: string): boolean {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => type.toLowerCase() === elem)
}

function isBoolean(...args: string[]): boolean {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
